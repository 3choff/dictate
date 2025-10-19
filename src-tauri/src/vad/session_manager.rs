use anyhow::Result;
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

use super::{SileroVad, SmoothedVad, VadFrame, VoiceActivityDetector};

const WHISPER_SAMPLE_RATE: u32 = 16000;
const SILERO_FRAME_SAMPLES: usize = 480; // 30ms @ 16kHz

pub struct VadSession {
    vad: SmoothedVad,
    audio_buffer: Vec<f32>,
    session_id: String,
    
    // Configuration
    chunk_duration_ms: u64,
    silence_duration_ms: u64,
    
    // State
    last_speech_time: Instant,
    is_recording: bool,
}

impl VadSession {
    pub fn new(
        vad: SmoothedVad,
        session_id: String,
        chunk_duration_ms: u64,
        silence_duration_ms: u64,
    ) -> Self {
        Self {
            vad,
            audio_buffer: Vec::new(),
            session_id,
            chunk_duration_ms,
            silence_duration_ms,
            last_speech_time: Instant::now(),
            is_recording: false,
        }
    }
}

#[derive(Clone)]
pub struct VadSessionManager {
    sessions: Arc<Mutex<HashMap<String, VadSession>>>,
    app_handle: AppHandle,
}

impl VadSessionManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            app_handle,
        }
    }

    /// Create a new VAD session
    pub fn create_session(
        &self,
        session_id: String,
        threshold: Option<f32>,
        silence_duration_ms: Option<u64>,
    ) -> Result<()> {
        let threshold = threshold.unwrap_or(0.3);
        let silence_duration_ms = silence_duration_ms.unwrap_or(400);
        
        // Resolve VAD model path
        let vad_path = self.app_handle
            .path()
            .resolve(
                "resources/models/silero_vad_v4.onnx",
                tauri::path::BaseDirectory::Resource,
            )
            .map_err(|e| anyhow::anyhow!("Failed to resolve VAD model path: {}", e))?;

        // Create Silero VAD
        let silero = SileroVad::new(vad_path, threshold)
            .map_err(|e| anyhow::anyhow!("Failed to create SileroVad: {}", e))?;

        // Wrap with smoothing: optimized for faster segmentation
        let smoothed_vad = SmoothedVad::new(
            Box::new(silero),
            10,  // prefill_frames (~300ms) - optimized for faster response
            10,  // hangover_frames (~300ms) - reduced from 15 for faster cutoff
            2,   // onset_frames (~60ms) - keep to avoid false positives
        );

        // Create session
        let session = VadSession::new(
            smoothed_vad,
            session_id.clone(),
            30_000, // 30 seconds max chunk duration
            silence_duration_ms,
        );

        // Store session
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), session);

        Ok(())
    }

    /// Push audio frame to VAD (non-blocking)
    pub async fn push_frame(
        &self,
        session_id: String,
        audio_data: Vec<u8>,
    ) -> Result<(), String> {
        let sessions = self.sessions.clone();
        let app_handle = self.app_handle.clone();

        // Spawn non-blocking task
        tokio::spawn(async move {
            let mut sessions_lock = sessions.lock().unwrap();
            let session = sessions_lock
                .get_mut(&session_id)
                .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;

            // Convert bytes to f32 samples (PCM16 little-endian)
            let samples = Self::bytes_to_f32(&audio_data);

            // Process through VAD in 30ms chunks
            for chunk in samples.chunks(SILERO_FRAME_SAMPLES) {
                if chunk.len() != SILERO_FRAME_SAMPLES {
                    continue; // Skip incomplete frames
                }

                match session.vad.push_frame(chunk)? {
                    VadFrame::Speech(audio) => {
                        // Speech detected - buffer it
                        session.audio_buffer.extend_from_slice(audio);
                        session.last_speech_time = Instant::now();
                        session.is_recording = true;
                    }
                    VadFrame::Noise => {
                        // Check if silence duration exceeded
                        if session.is_recording {
                            let silence_duration = session.last_speech_time.elapsed();

                            if silence_duration.as_millis() as u64 > session.silence_duration_ms {
                                // Emit speech segment
                                if !session.audio_buffer.is_empty() {
                                    Self::emit_segment(
                                        &app_handle,
                                        &session.session_id,
                                        &session.audio_buffer,
                                    )?;

                                    session.audio_buffer.clear();
                                    session.is_recording = false;
                                }
                            }
                        }
                    }
                }

                // Max duration check - prevent overly long segments
                let buffer_duration_ms = (session.audio_buffer.len() as u64 * 1000) / WHISPER_SAMPLE_RATE as u64;

                if buffer_duration_ms > session.chunk_duration_ms {
                    // Force emit segment
                    if !session.audio_buffer.is_empty() {
                        Self::emit_segment(
                            &app_handle,
                            &session.session_id,
                            &session.audio_buffer,
                        )?;
                        session.audio_buffer.clear();
                    }
                }
            }

            Ok::<(), anyhow::Error>(())
        });

        Ok(())
    }

    /// Stop session and return final buffered audio
    pub fn stop_session(&self, session_id: String) -> Result<Vec<u8>, String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(&session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;

        // Get final buffered audio
        let final_audio = if !session.audio_buffer.is_empty() {
            Self::f32_to_pcm16_bytes(&session.audio_buffer)
        } else {
            Vec::new()
        };

        // Reset VAD state
        session.vad.reset();
        session.audio_buffer.clear();
        session.is_recording = false;

        Ok(final_audio)
    }

    /// Destroy session and clean up resources
    pub fn destroy_session(&self, session_id: String) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(&session_id);
        Ok(())
    }

    /// Emit speech segment as event to frontend
    fn emit_segment(
        app_handle: &AppHandle,
        session_id: &str,
        audio_buffer: &[f32],
    ) -> Result<(), anyhow::Error> {
        let pcm16_bytes = Self::f32_to_pcm16_bytes(audio_buffer);
        let duration_ms = (audio_buffer.len() * 1000) / WHISPER_SAMPLE_RATE as usize;

        app_handle.emit(
            "speech_segment_ready",
            json!({
                "session_id": session_id,
                "audio_data": pcm16_bytes,
                "duration_ms": duration_ms
            }),
        )?;

        Ok(())
    }

    /// Convert PCM16 bytes (little-endian) to f32 samples
    fn bytes_to_f32(bytes: &[u8]) -> Vec<f32> {
        bytes
            .chunks_exact(2)
            .map(|chunk| {
                let sample = i16::from_le_bytes([chunk[0], chunk[1]]);
                sample as f32 / 32768.0
            })
            .collect()
    }

    /// Convert f32 samples to PCM16 bytes (little-endian)
    fn f32_to_pcm16_bytes(samples: &[f32]) -> Vec<u8> {
        samples
            .iter()
            .flat_map(|&sample| {
                let clamped = sample.clamp(-1.0, 1.0);
                let int_sample = (clamped * 32767.0) as i16;
                int_sample.to_le_bytes()
            })
            .collect()
    }
}
