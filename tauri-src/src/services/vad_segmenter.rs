use std::sync::{Arc, Mutex};
use webrtc_vad::{Vad, VadMode, SampleRate};

/// VAD-based audio segmenter for batch transcription providers
/// Note: Vad is created per-call to avoid Send/Sync issues with raw pointers
pub struct VadSegmenterState {
    samples_buffer: Vec<i16>,
    trailing_non_speech_ms: u32,
    had_speech: bool,
    is_processing: bool,
    
    // Sustained speech detection (filters transients like claps)
    consecutive_speech_frames: u32,
    consecutive_non_speech_frames: u32,
    
    // Configuration
    trailing_silence_threshold_ms: u32,     // e.g., 1000ms
    min_segment_duration_ms: u32,           // e.g., 200ms
    max_segment_duration_ms: u32,           // e.g., 15000ms
    min_speech_frames_for_activation: u32,  // e.g., 5 frames (100ms) to confirm speech
    min_non_speech_frames_for_reset: u32,   // e.g., 3 frames (60ms) to confirm silence
}

impl VadSegmenterState {
    /// Create a new VAD segmenter state with default settings
    pub fn new() -> Self {
        Self {
            samples_buffer: Vec::new(),
            trailing_non_speech_ms: 0,
            had_speech: false,
            is_processing: false,
            consecutive_speech_frames: 0,
            consecutive_non_speech_frames: 0,
            trailing_silence_threshold_ms: 1000,  // 1 second as requested
            min_segment_duration_ms: 200,
            max_segment_duration_ms: 15000,
            min_speech_frames_for_activation: 5,  // Require 100ms of continuous speech
            min_non_speech_frames_for_reset: 3,   // Require 60ms of continuous silence
        }
    }
    
    /// Process a 20ms frame (320 samples @ 16kHz) and return segment decision
    /// Returns: (should_emit_segment, current_buffer_clone)
    pub fn process_frame(&mut self, frame: &[i16]) -> Result<(bool, Option<Vec<i16>>), String> {
        if frame.len() != 320 {
            return Err(format!("Frame must be exactly 320 samples (20ms @ 16kHz), got {}", frame.len()));
        }
        
        // Create VAD instance for this frame (cheap operation)
        let mut vad = Vad::new();
        // Use VeryAggressive mode to be stricter about what counts as speech
        vad.set_mode(VadMode::VeryAggressive);
        vad.set_sample_rate(SampleRate::Rate16kHz);
        
        // Run VAD on the frame
        let is_speech = vad.is_voice_segment(frame)
            .map_err(|e| format!("VAD processing error: {:?}", e))?;
        
        // Sustained speech detection - filter out transients (claps, pops, etc.)
        if is_speech {
            self.consecutive_speech_frames += 1;
            self.consecutive_non_speech_frames = 0;
            
            // Only consider it real speech after sustained detection
            if self.consecutive_speech_frames >= self.min_speech_frames_for_activation {
                self.had_speech = true;
                self.trailing_non_speech_ms = 0;
            }
        } else {
            self.consecutive_non_speech_frames += 1;
            self.consecutive_speech_frames = 0;
            
            // Only update trailing silence after sustained non-speech
            if self.consecutive_non_speech_frames >= self.min_non_speech_frames_for_reset {
                self.trailing_non_speech_ms += 20; // 20ms per frame
            }
        }
        
        // Accumulate samples
        self.samples_buffer.extend_from_slice(frame);
        
        let current_duration_ms = (self.samples_buffer.len() as u32 * 1000) / (16000);
        
        // Determine if we should emit a segment
        let should_emit = !self.is_processing && self.had_speech && (
            // Trailing non-speech threshold reached
            self.trailing_non_speech_ms >= self.trailing_silence_threshold_ms ||
            // Max duration reached
            current_duration_ms >= self.max_segment_duration_ms
        );
        
        if should_emit && current_duration_ms >= self.min_segment_duration_ms {
            // Clone the buffer for emission
            let segment = self.samples_buffer.clone();
            
            // Reset state for next segment
            self.samples_buffer.clear();
            self.trailing_non_speech_ms = 0;
            self.had_speech = false;
            self.is_processing = true;
            
            Ok((true, Some(segment)))
        } else {
            Ok((false, None))
        }
    }
    
    /// Mark that processing is complete (call after segment is sent to API)
    pub fn mark_processing_complete(&mut self) {
        self.is_processing = false;
    }
    
    /// Flush any remaining audio as a final segment
    pub fn flush(&mut self) -> Option<Vec<i16>> {
        let current_duration_ms = (self.samples_buffer.len() as u32 * 1000) / 16000;
        
        if self.had_speech && current_duration_ms >= self.min_segment_duration_ms {
            let segment = self.samples_buffer.clone();
            self.samples_buffer.clear();
            self.trailing_non_speech_ms = 0;
            self.had_speech = false;
            Some(segment)
        } else {
            None
        }
    }
    
    /// Reset the segmenter state
    pub fn reset(&mut self) {
        self.samples_buffer.clear();
        self.trailing_non_speech_ms = 0;
        self.had_speech = false;
        self.is_processing = false;
        self.consecutive_speech_frames = 0;
        self.consecutive_non_speech_frames = 0;
    }
}

/// Thread-safe wrapper for VAD segmenter (for use in Tauri state)
pub type SharedVadSegmenter = Arc<Mutex<VadSegmenterState>>;

pub fn create_shared_segmenter() -> SharedVadSegmenter {
    let segmenter = VadSegmenterState::new();
    Arc::new(Mutex::new(segmenter))
}
