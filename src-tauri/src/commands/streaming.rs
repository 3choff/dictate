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
            // Clone language for voice commands before passing ownership to start_streaming
            let voice_lang = language.clone();
            
            let (audio_tx, mut transcript_rx, mut partial_rx) = providers::deepgram::start_streaming(
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
            
            // Spawn task to forward partial transcripts to overlay
            let app_partial = app.clone();
            tokio::spawn(async move {
                let noise_re = regex::Regex::new(r"\[.*?\]|\(.*?\)").unwrap();
                let space_re = regex::Regex::new(r"\s+").unwrap();
                while let Some(partial_text) = partial_rx.recv().await {
                    let cleaned = noise_re.replace_all(&partial_text, " ");
                    let cleaned = space_re.replace_all(&cleaned, " ").trim().to_string();
                    
                    if let Some(window) = app_partial.get_webview_window("main") {
                        let _ = window.emit("streaming-partial-transcript", &cleaned);
                    }
                }
            });
            
            // Spawn task to handle incoming transcripts
            let app_clone = app.clone();
            let session_id_clone = session_id.clone();
            let sessions_clone = state.sessions.clone();
            
            let voice_cmds_enabled = voice_commands_enabled.unwrap_or(true);
            // voice_lang is already cloned above
            tokio::spawn(async move {
                while let Some(transcript) = transcript_rx.recv().await {
                    // Clear partial overlay when committed text arrives
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.emit("streaming-partial-clear", ());
                    }
                    
                    // Apply word correction if custom words are configured
                    let corrected_transcript = if let Ok(settings) = crate::commands::settings::get_settings(app_clone.clone()).await {
                        if settings.word_correction_enabled {
                            apply_word_correction_sync(&transcript, &settings.custom_words, settings.word_correction_threshold)
                        } else {
                            transcript.clone()
                        }
                    } else {
                        transcript.clone()
                    };
                    
                    // Process voice commands if enabled
                    if voice_cmds_enabled {
                        let voice_commands = VoiceCommands::new_with_language(&voice_lang);
                        let processed = process_voice_commands(&corrected_transcript, &voice_commands);
                        
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
                        let transcript_with_space = format!("{} ", corrected_transcript);
                        let _ = insert_transcript_text(&transcript_with_space, &insertion_mode, &app).await;
                    }
                    
                    // Emit event to frontend for status update
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.emit("streaming-transcript", corrected_transcript);
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
            // Clone language for voice commands before cart_language takes ownership
            let voice_lang = if language == "multi" || language.is_empty() {
                "en".to_string()
            } else {
                language.clone()
            };
            
            // Cartesia uses raw language code (omit for multilingual)
            let cart_language = if language == "multi" || language.is_empty() {
                None
            } else {
                Some(language)
            };
            
            let (audio_tx, mut transcript_rx, mut partial_rx) = providers::cartesia::start_streaming(
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
            
            // Spawn task to forward partial transcripts to overlay
            let app_partial = app.clone();
            tokio::spawn(async move {
                let noise_re = regex::Regex::new(r"\[.*?\]|\(.*?\)").unwrap();
                let space_re = regex::Regex::new(r"\s+").unwrap();
                while let Some(partial_text) = partial_rx.recv().await {
                    let cleaned = noise_re.replace_all(&partial_text, " ");
                    let cleaned = space_re.replace_all(&cleaned, " ").trim().to_string();
                    
                    if let Some(window) = app_partial.get_webview_window("main") {
                        let _ = window.emit("streaming-partial-transcript", &cleaned);
                    }
                }
            });
            
            // Spawn task to handle incoming transcripts
            let app_clone = app.clone();
            let session_id_clone = session_id.clone();
            let sessions_clone = state.sessions.clone();
            
            let voice_cmds_enabled = voice_commands_enabled.unwrap_or(true);
            tokio::spawn(async move {
                while let Some(transcript) = transcript_rx.recv().await {
                    // Clear partial overlay when committed text arrives
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.emit("streaming-partial-clear", ());
                    }
                    
                    // Apply formatting based on smart_format setting
                    let formatted_transcript = if smart_format {
                        transcript
                    } else {
                        // Normalize like Electron app: lowercase + remove punctuation
                        normalize_whisper_transcript(&transcript)
                    };
                    
                    // Apply word correction if custom words are configured
                    // Apply word correction if custom words are configured
                    let corrected_transcript = if let Ok(settings) = crate::commands::settings::get_settings(app_clone.clone()).await {
                        if settings.word_correction_enabled {
                            apply_word_correction_sync(&formatted_transcript, &settings.custom_words, settings.word_correction_threshold)
                        } else {
                            formatted_transcript.clone()
                        }
                    } else {
                        formatted_transcript.clone()
                    };
                    
                    // Process voice commands if enabled
                    if voice_cmds_enabled {
                        let voice_commands = VoiceCommands::new_with_language(&voice_lang);
                        let processed = process_voice_commands(&corrected_transcript, &voice_commands);
                        
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
                        let transcript_with_space = format!("{} ", corrected_transcript);
                        let _ = insert_transcript_text(&transcript_with_space, &insertion_mode, &app_clone).await;
                    }
                    
                    // Emit event to frontend for status update
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.emit("streaming-transcript", corrected_transcript);
                    }
                }
                
                // Clean up session when done
                let mut sessions = sessions_clone.lock().await;
                sessions.remove(&session_id_clone);
            });
            
            Ok(session_id)
        }
        "voxtral" => {
            // Start Voxtral realtime streaming (no language param - auto-detected)
            // Default voice commands to English since Voxtral auto-detects
            let voice_lang = if language == "multi" || language.is_empty() {
                "en".to_string()
            } else {
                language.clone()
            };
            
            let (audio_tx, mut transcript_rx) = providers::voxtral::start_streaming(
                api_key,
            )
            .await
            .map_err(|e| format!("Failed to start Voxtral: {}", e))?;
            
            // Store audio sender for this session
            {
                let mut sessions = state.sessions.lock().await;
                sessions.insert(session_id.clone(), audio_tx);
            }
            
            // Spawn task to handle incoming stable transcripts (or fast in single-stream mode)
            let app_clone = app.clone();
            let session_id_clone = session_id.clone();
            let sessions_clone = state.sessions.clone();
            
            let voice_cmds_enabled = voice_commands_enabled.unwrap_or(true);
            #[allow(unused_assignments)]
            tokio::spawn(async move {
                // Word buffer for multi-word voice command detection.
                // Voxtral sends one word per delta, so we accumulate words here
                // and check if they form a voice command before inserting text.
                let mut pending_buffer = String::new();
                let mut pending_leading_space = false;
                
                // After a voice command, suppress trailing punctuation (period/comma)
                // that the model adds because the user paused speaking.
                #[allow(unused_assignments)]
                let mut last_command_time: Option<tokio::time::Instant> = None;
                
                let voice_commands = if voice_cmds_enabled {
                    Some(VoiceCommands::new_with_language(&voice_lang))
                } else {
                    None
                };
                
                // Helper closure removed as overlay is disabled for Voxtral
                let emit_clear = |_app: &AppHandle| {
                    // No-op
                };
                
                // === Two-tier buffer for Voxtral syllable fragmentation ===
                //
                // Tier 1: Fragment assembly (`current_word`)
                //   Voxtral sends syllable fragments: "ex" + "pect" + "ation"
                //   Fragments without a leading space are concatenated.
                //   When a space-prefixed delta arrives, the previous word is complete.
                //
                // Tier 2: Word buffer (`pending_buffer`)
                //   Completed words are pushed here for voice command matching.
                //   Only complete words are checked against commands & word correction.
                
                let mut current_word = String::new();       // Tier 1: syllable fragment assembly
                #[allow(unused_assignments)]
                let mut current_word_has_leading_space = false;
                
                // Helper: push a completed word into pending_buffer and check commands
                #[allow(unused_assignments)]
                macro_rules! push_completed_word {
                    ($completed:expr, $had_leading_space:expr) => {{
                        let completed_word: String = $completed;
                        let word_leading: bool = $had_leading_space;
                        
                        if completed_word.is_empty() {
                            // Nothing to push
                        } else if !voice_cmds_enabled {
                            // No voice commands: insert the word directly
                            let formatted = if smart_format {
                                completed_word.clone()
                            } else {
                                normalize_whisper_transcript(&completed_word)
                            };
                            let corrected = apply_word_correction_if_needed(&formatted, &app_clone).await;
                            let final_text = if word_leading && !corrected.starts_with(' ') {
                                format!(" {}", corrected)
                            } else {
                                corrected.clone()
                            };
                            let _ = insert_transcript_text(&final_text, &insertion_mode, &app_clone).await;
                            
                            if let Some(window) = app_clone.get_webview_window("main") {
                                let _ = window.emit("streaming-transcript", &corrected);
                            }
                            emit_clear(&app_clone);
                        } else {
                            // Voice commands enabled: push to word buffer
                            let vc = voice_commands.as_ref().unwrap();
                            
                            // Check if this is post-command punctuation to suppress
                            let mut skip = false;
                            if let Some(cmd_time) = last_command_time {
                                if cmd_time.elapsed() < tokio::time::Duration::from_millis(500) {
                                    let trimmed_lower = completed_word.trim().to_lowercase();
                                    if trimmed_lower == "." || trimmed_lower == "," {
                                        last_command_time = None;
                                        skip = true;
                                    }
                                }
                                if !skip {
                                    last_command_time = None;
                                }
                            }
                            
                            if !skip {
                                // Track leading space
                                if pending_buffer.is_empty() {
                                    pending_leading_space = word_leading;
                                }
                                
                                // Append completed word to pending buffer
                                if pending_buffer.is_empty() {
                                    pending_buffer = completed_word;
                                } else {
                                    pending_buffer = format!("{} {}", pending_buffer, completed_word);
                                }
                                
                                // Check buffer against voice commands
                                if vc.is_exact_command(&pending_buffer) && !vc.is_command_prefix(&pending_buffer) {
                                    let buffer_text = if let Some(cmd) = vc.reconstruct_command(&pending_buffer) {
                                        pending_buffer.clear();
                                        cmd
                                    } else {
                                        std::mem::take(&mut pending_buffer)
                                    };
                                    let leading = pending_leading_space;
                                    pending_leading_space = false;
                                    
                                    let had_cmd = flush_voxtral_text(
                                        &buffer_text, leading, smart_format,
                                        &insertion_mode, &app_clone, &voice_commands
                                    ).await;
                                    if had_cmd {
                                        last_command_time = Some(tokio::time::Instant::now());
                                    }
                                    emit_clear(&app_clone);
                                } else if vc.is_command_prefix(&pending_buffer) || vc.is_exact_command(&pending_buffer) {
                                    // Could become a longer command → hold the buffer
                                } else {
                                    // Not a command → flush immediately
                                    let buffer_text = std::mem::take(&mut pending_buffer);
                                    let leading = pending_leading_space;
                                    pending_leading_space = false;
                                    
                                    let had_cmd = flush_voxtral_text(
                                        &buffer_text, leading, smart_format,
                                        &insertion_mode, &app_clone, &voice_commands
                                    ).await;
                                    if had_cmd {
                                        last_command_time = Some(tokio::time::Instant::now());
                                    }
                                    emit_clear(&app_clone);
                                }
                            }
                        }
                    }};
                }
                
                loop {
                    // Determine timeout: use shorter timeout for fragment assembly,
                    // longer timeout for voice command buffer
                    let needs_timeout = !current_word.is_empty() || (!pending_buffer.is_empty() && voice_cmds_enabled);
                    let timeout_ms = if !current_word.is_empty() { 300 } else { 700 };
                    
                    let recv_result = if needs_timeout {
                        match tokio::time::timeout(
                            tokio::time::Duration::from_millis(timeout_ms),
                            transcript_rx.recv()
                        ).await {
                            Ok(result) => result,
                            Err(_) => {
                                // Timeout fired. Two cases:
                                // 1) current_word was non-empty (300ms timeout) → push it, but
                                //    do NOT flush pending_buffer yet. Let it get its own 700ms timeout.
                                // 2) current_word was empty (700ms timeout) → flush pending_buffer.
                                
                                let had_current_word = !current_word.is_empty();
                                
                                if had_current_word {
                                    let word = std::mem::take(&mut current_word);
                                    let leading = current_word_has_leading_space;
                                    current_word_has_leading_space = false;
                                    push_completed_word!(word, leading);
                                    // Do NOT flush pending_buffer here — it may be holding
                                    // a command prefix like "question" waiting for "mark".
                                    // The next loop iteration will set a 700ms timeout for it.
                                }
                                
                                // Only flush pending_buffer on a dedicated 700ms timeout
                                // (i.e., when current_word was already empty at timeout)
                                if !had_current_word && !pending_buffer.is_empty() {
                                    let buffer_text = std::mem::take(&mut pending_buffer);
                                    let leading = pending_leading_space;
                                    pending_leading_space = false;
                                    
                                    let had_cmd = flush_voxtral_text(
                                        &buffer_text, leading, smart_format,
                                        &insertion_mode, &app_clone, &voice_commands
                                    ).await;
                                    if had_cmd {
                                        last_command_time = Some(tokio::time::Instant::now());
                                    }
                                    emit_clear(&app_clone);
                                }
                                
                                continue;
                            }
                        }
                    } else {
                        transcript_rx.recv().await
                    };
                    
                    let raw_transcript = match recv_result {
                        Some(t) => t,
                        None => break, // Channel closed
                    };
                    
                    if raw_transcript.is_empty() {
                        continue;
                    }
                    
                    // Replace newlines with spaces to treat them as word boundaries
                    let transcript = raw_transcript.replace('\n', " ").replace('\r', "");
                    
                    // A Voxtral transcript delta might contain multiple words (e.g. " Select all.").
                    // We split by space to ensure we assemble fragments and emit complete words singly.
                    let mut splits = transcript.split(' ');
                    
                    if let Some(first) = splits.next() {
                        if !first.is_empty() {
                            current_word.push_str(first);
                        }
                        
                        for part in splits {
                            if !current_word.is_empty() {
                                let completed = std::mem::take(&mut current_word);
                                let leading = current_word_has_leading_space;
                                push_completed_word!(completed, leading);
                            }
                            
                            current_word = part.to_string();
                            current_word_has_leading_space = true;
                        }
                    }
                }
                
                // Flush any remaining fragments and buffer on session end
                if !current_word.is_empty() {
                    let word = std::mem::take(&mut current_word);
                    let leading = current_word_has_leading_space;
                    push_completed_word!(word, leading);
                }
                if !pending_buffer.is_empty() {
                    let buffer_text = std::mem::take(&mut pending_buffer);
                    let leading = pending_leading_space;
                    
                    flush_voxtral_text(
                        &buffer_text, leading, smart_format,
                        &insertion_mode, &app_clone, &voice_commands
                    ).await;
                }
                
                // Clean up session when done
                let mut sessions = sessions_clone.lock().await;
                sessions.remove(&session_id_clone);
            });
            
            Ok(session_id)
        }
        "elevenlabs" => {
            // Start ElevenLabs Scribe v2 realtime streaming
            // Clone language for voice commands before el_language takes ownership
            let voice_lang = if language == "multi" || language.is_empty() {
                "en".to_string()
            } else {
                language.clone()
            };
            
            // ElevenLabs uses language_code param (omit for multilingual/auto-detect)
            let el_language = if language == "multi" || language.is_empty() {
                None
            } else {
                Some(language)
            };
            
            let (audio_tx, mut transcript_rx, mut partial_rx) = providers::elevenlabs::start_streaming(
                api_key,
                el_language,
            )
            .await
            .map_err(|e| format!("Failed to start ElevenLabs: {}", e))?;
            
            // Store audio sender for this session
            {
                let mut sessions = state.sessions.lock().await;
                sessions.insert(session_id.clone(), audio_tx);
            }
            
            // Spawn task to forward partial transcripts to overlay
            let app_partial = app.clone();
            tokio::spawn(async move {
                let noise_re = regex::Regex::new(r"\[.*?\]|\(.*?\)").unwrap();
                let space_re = regex::Regex::new(r"\s+").unwrap();
                while let Some(partial_text) = partial_rx.recv().await {
                    let cleaned = noise_re.replace_all(&partial_text, " ");
                    let cleaned = space_re.replace_all(&cleaned, " ").trim().to_string();
                    
                    if let Some(window) = app_partial.get_webview_window("main") {
                        let _ = window.emit("streaming-partial-transcript", &cleaned);
                    }
                }
            });
            
            // Spawn task to handle incoming committed transcripts
            let app_clone = app.clone();
            let session_id_clone = session_id.clone();
            let sessions_clone = state.sessions.clone();
            
            let voice_cmds_enabled = voice_commands_enabled.unwrap_or(true);
            tokio::spawn(async move {
                let noise_re = regex::Regex::new(r"\[.*?\]|\(.*?\)").unwrap();
                let space_re = regex::Regex::new(r"\s+").unwrap();
                while let Some(raw_transcript) = transcript_rx.recv().await {
                    let transcript = noise_re.replace_all(&raw_transcript, " ");
                    let transcript = space_re.replace_all(&transcript, " ").trim().to_string();
                    // Clear partial overlay when committed text arrives
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.emit("streaming-partial-clear", ());
                    }
                    
                    // Apply formatting based on smart_format setting
                    let formatted_transcript = if smart_format {
                        transcript
                    } else {
                        normalize_whisper_transcript(&transcript)
                    };
                    
                    // Apply word correction if custom words are configured
                    let corrected_transcript = if let Ok(settings) = crate::commands::settings::get_settings(app_clone.clone()).await {
                        if settings.word_correction_enabled {
                            apply_word_correction_sync(&formatted_transcript, &settings.custom_words, settings.word_correction_threshold)
                        } else {
                            formatted_transcript.clone()
                        }
                    } else {
                        formatted_transcript.clone()
                    };
                    
                    // Process voice commands if enabled
                    if voice_cmds_enabled {
                        let voice_commands = VoiceCommands::new_with_language(&voice_lang);
                        let processed = process_voice_commands(&corrected_transcript, &voice_commands);
                        
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
                        let transcript_with_space = format!("{} ", corrected_transcript);
                        let _ = insert_transcript_text(&transcript_with_space, &insertion_mode, &app_clone).await;
                    }
                    
                    // Emit event to frontend for status update
                    if let Some(window) = app_clone.get_webview_window("main") {
                        let _ = window.emit("streaming-transcript", corrected_transcript);
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
async fn insert_transcript_text(text: &str, insertion_mode: &str, app_handle: &AppHandle) -> Result<(), String> {
    if insertion_mode == "typing" {
        services::direct_typing::inject_text_native(text, app_handle)
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
    
    // Remove all punctuation characters except apostrophes (to preserve contractions like "don't" or "dell'auto")
    let cleaned: String = lower
        .chars()
        .filter(|c| !matches!(c, '.' | ',' | '/' | '#' | '!' | '$' | '%' | '^' | '&' | '*' 
                              | ';' | ':' | '{' | '}' | '=' | '_' | '~' | '(' 
                              | ')' | '[' | ']' | '"' | '<' | '>' | '?' | '@' | '+' | '|' 
                              | '\\' | '-'))
        .collect();
    
    // Replace multiple spaces with single space and trim
    cleaned.split_whitespace().collect::<Vec<&str>>().join(" ")
}

// Helper function to apply word correction to transcript
fn apply_word_correction_sync(text: &str, custom_words: &[String], threshold: f64) -> String {
    if custom_words.is_empty() {
        return text.to_string();
    }
    services::word_correction::apply_custom_words(text, custom_words, threshold)
}

/// Execute a voice command action (for streaming)
async fn execute_streaming_command_action(action: &CommandAction, app: &AppHandle) -> Result<(), String> {
    match action {
        CommandAction::KeyPress(key) => {
            services::direct_typing::send_key_native(key, app)
                .map_err(|e| e.to_string())
        }
        CommandAction::KeyCombo(modifier, key) => {
            services::direct_typing::send_key_combo_native(modifier, key, app)
                .map_err(|e| e.to_string())
        }
        CommandAction::DeleteLastWord => {
            // Smart delete: if text is selected, delete the selection.
            // If nothing is selected, fall back to Ctrl+Backspace to delete last word.
            let app_clone = app.clone();
            tokio::task::spawn_blocking(move || {
                services::clipboard_paste::delete_selected_or_last_word(&app_clone)
            })
            .await
            .map_err(|e| format!("Task join error: {}", e))?
        }
        CommandAction::Rewrite => {
            // Emit event to trigger text rewrite - frontend handles smart selection
            if let Some(window) = app.get_webview_window("main") {
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                let _ = window.emit("sparkle-trigger", ());
            } else {
                eprintln!("[Voice Commands] Main window not found for rewrite trigger");
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

/// Flush buffered Voxtral text: apply formatting, word correction, voice commands, and insert.
/// Returns true if a voice command was executed (used for post-command punctuation suppression).
async fn flush_voxtral_text(
    buffer_text: &str,
    has_leading_space: bool,
    smart_format: bool,
    insertion_mode: &str,
    app: &AppHandle,
    voice_commands: &Option<VoiceCommands>,
) -> bool {
    // Apply formatting
    let formatted = if smart_format {
        buffer_text.to_string()
    } else {
        normalize_whisper_transcript(buffer_text)
    };
    
    // Apply word correction
    let corrected = apply_word_correction_if_needed(&formatted, app).await;
    
    // Process voice commands if available
    let mut had_command = false;
    if let Some(vc) = voice_commands {
        let processed = process_voice_commands(&corrected, vc);
        had_command = processed.had_any_command;
        
        // Execute command actions
        for action in &processed.actions {
            if let Err(e) = execute_streaming_command_action(action, app).await {
                eprintln!("[Voice Commands] Failed to execute action: {}", e);
            }
        }
        
        // Build text to insert from remaining + processed
        let text_to_insert = if processed.remaining_text.is_empty() {
            processed.processed_text.clone()
        } else if processed.processed_text.is_empty() {
            processed.remaining_text.clone()
        } else {
            format!("{}{}", processed.remaining_text, processed.processed_text)
        };
        
        if !text_to_insert.is_empty() {
            let final_text = if has_leading_space && !text_to_insert.starts_with(' ') {
                format!(" {}", text_to_insert)
            } else {
                text_to_insert
            };
            let _ = insert_transcript_text(&final_text, insertion_mode, app).await;
        }
    } else {
        // No voice commands - insert directly
        let final_text = if has_leading_space && !corrected.starts_with(' ') {
            format!(" {}", corrected)
        } else {
            corrected.clone()
        };
        let _ = insert_transcript_text(&final_text, insertion_mode, app).await;
    }
    
    // Emit event to frontend
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("streaming-transcript", corrected);
    }
    
    had_command
}

/// Apply word correction using app settings (async helper for Voxtral buffer)
async fn apply_word_correction_if_needed(text: &str, app: &AppHandle) -> String {
    if let Ok(settings) = crate::commands::settings::get_settings(app.clone()).await {
        if settings.word_correction_enabled {
            apply_word_correction_sync(text, &settings.custom_words, settings.word_correction_threshold)
        } else {
            text.to_string()
        }
    } else {
        text.to_string()
    }
}
