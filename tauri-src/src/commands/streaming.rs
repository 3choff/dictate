use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use std::collections::HashMap;
use std::sync::Arc;

use crate::providers;
use crate::services;

// Global state for active streaming sessions
type AudioSender = tokio::sync::mpsc::Sender<Vec<u8>>;
type StreamingSessions = Arc<Mutex<HashMap<String, AudioSender>>>;

// Store streaming sessions in app state
pub struct StreamingState {
    pub sessions: StreamingSessions,
}

impl Default for StreamingState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

/// Start streaming transcription session
#[tauri::command]
pub async fn start_streaming_transcription(
    app: AppHandle,
    provider: String,
    api_key: String,
    language: String,
    smart_format: bool,
    insertion_mode: String,
    encoding: Option<String>,
) -> Result<String, String> {
    // Get or create streaming state
    let state = app.state::<StreamingState>();
    
    // Check if provider is supported
    let session_id = format!("{}_{}", provider, chrono::Utc::now().timestamp());
    
    match provider.as_str() {
        "deepgram" => {
            // Start Deepgram streaming
            let (audio_tx, mut transcript_rx) = providers::deepgram::start_streaming(
                api_key,
                language,
                smart_format,
                encoding,
            )
            .await
            .map_err(|e| format!("Failed to start Deepgram: {}", e))?;
            
            // Store audio sender for this session
            {
                let mut sessions = state.sessions.lock().await;
                sessions.insert(session_id.clone(), audio_tx);
            }
            
            // Spawn task to handle incoming transcripts
            let app_clone = app.clone();
            let session_id_clone = session_id.clone();
            let sessions_clone = state.sessions.clone();
            
            tokio::spawn(async move {
                while let Some(transcript) = transcript_rx.recv().await {
                    // Add space after each transcript segment to separate words
                    let transcript_with_space = format!("{} ", transcript);
                    
                    // Insert text using configured mode
                    let _ = insert_transcript_text(&transcript_with_space, &insertion_mode).await;
                    
                    // Emit event to frontend for status update
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.emit("streaming-transcript", transcript);
                    }
                }
                
                // Clean up session when done
                let mut sessions = sessions_clone.lock().await;
                sessions.remove(&session_id_clone);
            });
            
            Ok(session_id)
        }
        _ => Err(format!("Unsupported streaming provider: {}", provider)),
    }
}

/// Send audio chunk to active streaming session
#[tauri::command]
pub async fn send_streaming_audio(
    app: AppHandle,
    session_id: String,
    audio_data: Vec<u8>,
) -> Result<(), String> {
    let state = app.state::<StreamingState>();
    let sessions = state.sessions.lock().await;
    
    if let Some(audio_tx) = sessions.get(&session_id) {
        audio_tx
            .send(audio_data)
            .await
            .map_err(|e| format!("Failed to send audio: {}", e))?;
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

/// Stop streaming transcription session
#[tauri::command]
pub async fn stop_streaming_transcription(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    let state = app.state::<StreamingState>();
    let mut sessions = state.sessions.lock().await;
    
    if let Some(audio_tx) = sessions.remove(&session_id) {
        // Send empty data to signal close
        let _ = audio_tx.send(vec![]).await;
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

// Helper function to insert transcript text
async fn insert_transcript_text(text: &str, insertion_mode: &str) -> Result<(), String> {
    if insertion_mode == "typing" {
        services::keyboard_inject::inject_text_native(text)
            .map_err(|e| e.to_string())
    } else {
        services::keyboard::insert_text_via_clipboard(text)
            .map_err(|e| e.to_string())
    }
}
