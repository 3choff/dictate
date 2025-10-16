use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use std::collections::HashMap;
use std::sync::Arc;

use crate::providers;
use crate::services;
use crate::voice_commands::{VoiceCommands, process_voice_commands, CommandAction};

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
    voice_commands_enabled: Option<bool>,
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
            
            // Start the visualizer
            if let Some(visualizer) = app.try_state::<crate::visualizer_manager::VisualizerManager>() {
                println!("[Streaming] Starting visualizer for session: {}", session_id);
                visualizer.start().await;
            } else {
                eprintln!("[Streaming] Warning: VisualizerManager not found in app state");
            }
            
            // Spawn task to handle incoming transcripts
            let app_clone = app.clone();
            let session_id_clone = session_id.clone();
            let sessions_clone = state.sessions.clone();
            
            let voice_cmds_enabled = voice_commands_enabled.unwrap_or(true);
            tokio::spawn(async move {
                while let Some(transcript) = transcript_rx.recv().await {
                    // Process voice commands if enabled
                    if voice_cmds_enabled {
                        let voice_commands = VoiceCommands::new();
                        let processed = process_voice_commands(&transcript, &voice_commands);
                        
                        // Execute command actions
                        for action in &processed.actions {
                            if let Err(e) = execute_streaming_command_action(action, &app_clone).await {
                                eprintln!("[Voice Commands] Failed to execute action: {}", e);
                            }
                        }
                        
                        // Insert remaining text
                        let text_to_insert = if processed.remaining_text.is_empty() {
                            processed.processed_text.clone()
                        } else if processed.processed_text.is_empty() {
                            if processed.had_key_action {
                                processed.remaining_text.clone()
                            } else {
                                format!("{} ", processed.remaining_text)
                            }
                        } else {
                            format!("{}{}", processed.remaining_text, processed.processed_text)
                        };
                        
                        if !text_to_insert.is_empty() {
                            let _ = insert_transcript_text(&text_to_insert, &insertion_mode, &app).await;
                        }
                    } else {
                        // No voice commands - insert directly with space
                        let transcript_with_space = format!("{} ", transcript);
                        let _ = insert_transcript_text(&transcript_with_space, &insertion_mode, &app).await;
                    }
                    
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
        "cartesia" => {
            // Start Cartesia streaming
            // Cartesia uses raw language code (omit for multilingual)
            let cart_language = if language == "multi" || language.is_empty() {
                None
            } else {
                Some(language)
            };
            
            let (audio_tx, mut transcript_rx) = providers::cartesia::start_streaming(
                api_key,
                cart_language,
            )
            .await
            .map_err(|e| format!("Failed to start Cartesia: {}", e))?;
            
            // Store audio sender for this session
            {
                let mut sessions = state.sessions.lock().await;
                sessions.insert(session_id.clone(), audio_tx);
            }
            
            // Start the visualizer before spawning task
            if let Some(visualizer) = app.try_state::<crate::visualizer_manager::VisualizerManager>() {
                println!("[Streaming] Starting visualizer for session: {}", session_id);
                visualizer.start().await;
            } else {
                eprintln!("[Streaming] Warning: VisualizerManager not found in app state");
            }
            
            // Spawn task to handle incoming transcripts
            let app_clone = app.clone();
            let session_id_clone = session_id.clone();
            let sessions_clone = state.sessions.clone();
            
            let voice_cmds_enabled = voice_commands_enabled.unwrap_or(true);
            tokio::spawn(async move {
                while let Some(transcript) = transcript_rx.recv().await {
                    // Apply formatting based on smart_format setting
                    let formatted_transcript = if smart_format {
                        transcript
                    } else {
                        // Normalize like Electron app: lowercase + remove punctuation
                        normalize_whisper_transcript(&transcript)
                    };
                    
                    // Process voice commands if enabled
                    if voice_cmds_enabled {
                        let voice_commands = VoiceCommands::new();
                        let processed = process_voice_commands(&formatted_transcript, &voice_commands);
                        
                        // Execute command actions
                        for action in &processed.actions {
                            if let Err(e) = execute_streaming_command_action(action, &app_clone).await {
                                eprintln!("[Voice Commands] Failed to execute action: {}", e);
                            }
                        }
                        
                        // Insert remaining text
                        let text_to_insert = if processed.remaining_text.is_empty() {
                            processed.processed_text.clone()
                        } else if processed.processed_text.is_empty() {
                            if processed.had_key_action {
                                processed.remaining_text.clone()
                            } else {
                                format!("{} ", processed.remaining_text)
                            }
                        } else {
                            format!("{}{}", processed.remaining_text, processed.processed_text)
                        };
                        
                        if !text_to_insert.is_empty() {
                            let _ = insert_transcript_text(&text_to_insert, &insertion_mode, &app_clone).await;
                        }
                    } else {
                        // No voice commands - insert directly with space
                        let transcript_with_space = format!("{} ", formatted_transcript);
                        let _ = insert_transcript_text(&transcript_with_space, &insertion_mode, &app_clone).await;
                    }
                    
                    // Emit event to frontend for status update
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.emit("streaming-transcript", formatted_transcript);
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
        // Send to transcription
        audio_tx
            .send(audio_data.clone())
            .await
            .map_err(|e| format!("Failed to send audio: {}", e))?;
        
        // Also send to visualizer (convert u8 to f32 PCM)
        if let Some(visualizer) = app.try_state::<crate::visualizer_manager::VisualizerManager>() {
            // Convert Vec<u8> to Vec<f32> assuming 16-bit PCM audio
            let samples: Vec<f32> = audio_data
                .chunks_exact(2)
                .map(|chunk| {
                    let sample = i16::from_le_bytes([chunk[0], chunk[1]]);
                    sample as f32 / 32768.0  // Normalize to -1.0 to 1.0
                })
                .collect();
            
            visualizer.send_audio_chunk(samples).await;
        }
        
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

/// Send audio chunk to visualizer only (for Deepgram which uses separate encoded stream)
#[tauri::command]
pub async fn send_visualization_audio(
    app: AppHandle,
    audio_data: Vec<u8>,
) -> Result<(), String> {
    // Only send to visualizer, not to transcription provider
    if let Some(visualizer) = app.try_state::<crate::visualizer_manager::VisualizerManager>() {
        // Convert Vec<u8> to Vec<f32> assuming 16-bit PCM audio
        let samples: Vec<f32> = audio_data
            .chunks_exact(2)
            .map(|chunk| {
                let sample = i16::from_le_bytes([chunk[0], chunk[1]]);
                sample as f32 / 32768.0  // Normalize to -1.0 to 1.0
            })
            .collect();
        
        visualizer.send_audio_chunk(samples).await;
    }
    
    Ok(())
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
        
        // Stop the visualizer
        if let Some(visualizer) = app.try_state::<crate::visualizer_manager::VisualizerManager>() {
            println!("[Streaming] Stopping visualizer for session: {}", session_id);
            visualizer.stop().await;
        } else {
            eprintln!("[Streaming] Warning: Cannot stop visualizer - VisualizerManager not found");
        }
        
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

// Helper function to insert transcript text
async fn insert_transcript_text(text: &str, insertion_mode: &str, app_handle: &AppHandle) -> Result<(), String> {
    if insertion_mode == "typing" {
        services::direct_typing::inject_text_native(text)
            .map_err(|e| e.to_string())
    } else {
        services::clipboard_paste::insert_text_via_clipboard(text, app_handle)
            .map_err(|e| e.to_string())
    }
}

// Helper function to normalize Whisper-based transcript (matches Electron app behavior)
fn normalize_whisper_transcript(text: &str) -> String {
    // Lowercase the text
    let lower = text.to_lowercase();
    
    // Remove all punctuation characters
    let cleaned: String = lower
        .chars()
        .filter(|c| !matches!(c, '.' | ',' | '/' | '#' | '!' | '$' | '%' | '^' | '&' | '*' 
                              | ';' | ':' | '{' | '}' | '=' | '_' | '\'' | '`' | '~' | '(' 
                              | ')' | '[' | ']' | '"' | '<' | '>' | '?' | '@' | '+' | '|' 
                              | '\\' | '-'))
        .collect();
    
    // Replace multiple spaces with single space and trim
    cleaned.split_whitespace().collect::<Vec<&str>>().join(" ")
}

/// Execute a voice command action (for streaming)
async fn execute_streaming_command_action(action: &CommandAction, app: &AppHandle) -> Result<(), String> {
    match action {
        CommandAction::KeyPress(key) => {
            services::direct_typing::send_key_native(key)
                .map_err(|e| e.to_string())
        }
        CommandAction::KeyCombo(modifier, key) => {
            services::direct_typing::send_key_combo_native(modifier, key)
                .map_err(|e| e.to_string())
        }
        CommandAction::DeleteLastWord => {
            // Send Ctrl+Backspace to delete last word
            services::direct_typing::send_key_combo_native("control", "backspace")
                .map_err(|e| e.to_string())
        }
        CommandAction::GrammarCorrect => {
            // Emit event to trigger grammar correction
            if let Some(window) = app.get_webview_window("main") {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                // First select all
                let _ = services::direct_typing::send_key_combo_native("control", "a");
                tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
                // Then trigger grammar correction shortcut
                let _ = window.emit("sparkle-trigger", ());
            }
            Ok(())
        }
        CommandAction::PauseDictation => {
            // Emit event to pause/stop dictation
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("toggle-recording", ());
            }
            Ok(())
        }
        CommandAction::InsertText(_) => {
            // Text insertion is handled separately in the main flow
            Ok(())
        }
    }
}

/// Start visualizer (for batch providers that don't use streaming sessions)
#[tauri::command]
pub async fn start_visualizer(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    if let Some(visualizer) = app.try_state::<crate::visualizer_manager::VisualizerManager>() {
        println!("[Visualizer] Starting for session: {}", session_id);
        visualizer.start().await;
        Ok(())
    } else {
        Err("VisualizerManager not found in app state".to_string())
    }
}

/// Stop visualizer (for batch providers)
#[tauri::command]
pub async fn stop_visualizer(app: AppHandle) -> Result<(), String> {
    if let Some(visualizer) = app.try_state::<crate::visualizer_manager::VisualizerManager>() {
        println!("[Visualizer] Stopping");
        visualizer.stop().await;
        Ok(())
    } else {
        Err("VisualizerManager not found in app state".to_string())
    }
}
