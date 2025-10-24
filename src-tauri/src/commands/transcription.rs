use crate::providers;
use crate::services;
use crate::voice_commands::{VoiceCommands, process_voice_commands, CommandAction};
use tauri::{AppHandle, Manager, Emitter};

/// Transcribe audio segment and insert text immediately
/// Supports multiple providers (Groq, SambaNova) with batch audio processing
#[tauri::command]
pub async fn transcribe_audio_segment(
    app: AppHandle,
    audio_data: Vec<u8>,
    api_key: String,
    insertion_mode: String,
    language: Option<String>,
    text_formatted: Option<bool>,
    api_service: Option<String>,
    voice_commands_enabled: Option<bool>,
) -> Result<String, String> {
    // Validate inputs
    if audio_data.is_empty() {
        return Err("No audio data provided".to_string());
    }
    
    if api_key.trim().is_empty() {
        return Err("API key is not set".to_string());
    }
    
    // Normalize language: 'multilingual' or empty -> None (auto-detect)
    let normalized_lang = match language.as_deref() {
        None => None,
        Some("") => None,
        Some("multilingual") => None,
        Some(code) => Some(code.to_string()),
    };

    // Route to selected provider (default: Groq)
    let service = api_service.unwrap_or_else(|| "groq".to_string());
    let result: Result<String, String> = match service.as_str() {
        "sambanova" => providers::sambanova::transcribe_verbose(audio_data, api_key, normalized_lang)
            .await
            .map_err(|e| e.to_string()),
        "fireworks" => providers::fireworks::transcribe_verbose(audio_data, api_key, normalized_lang)
            .await
            .map_err(|e| e.to_string()),
        "gemini" => providers::gemini::transcribe_verbose(audio_data, api_key, normalized_lang)
            .await
            .map_err(|e| e.to_string()),
        "mistral" => providers::mistral::transcribe_verbose(audio_data, api_key, normalized_lang)
            .await
            .map_err(|e| e.to_string()),
        _ => providers::groq::transcribe_verbose(audio_data, api_key, normalized_lang)
            .await
            .map_err(|e| e.to_string()),
    };

    let text = result
        .map_err(|error_msg| {
            
            // Check for specific error types
            if error_msg.contains("rate limit") || error_msg.contains("429") {
                "Rate limit exceeded. Please wait a moment.".to_string()
            } else if error_msg.contains("network") || error_msg.contains("connection") || error_msg.contains("Connection failed") {
                "Network error. Check your connection.".to_string()
            } else if error_msg.contains("401") || error_msg.contains("unauthorized") {
                "Invalid API key.".to_string()
            } else {
                format!("Transcription failed: {}", error_msg)
            }
        })?;
    
    // Skip empty transcriptions
    if text.trim().is_empty() {
        return Ok(String::new());
    }
    
    // Format text based on text_formatted setting
    let preserve_formatting = text_formatted.unwrap_or(true);  // Default true
    let formatted = if preserve_formatting {
        format_whisper_transcript(&text)
    } else {
        normalize_whisper_transcript(&text)
    };
    
    // Process voice commands if enabled
    let voice_cmds_enabled = voice_commands_enabled.unwrap_or(true);
    if voice_cmds_enabled {
        let voice_commands = VoiceCommands::new();
        let processed = process_voice_commands(&formatted, &voice_commands);
        
        // Execute command actions first
        for action in &processed.actions {
            if let Err(e) = execute_command_action(action, &app).await {
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
            match insertion_mode.as_str() {
                "typing" => {
                    services::direct_typing::inject_text_native(&text_to_insert)
                        .map_err(|e| format!("Failed to insert text: {}", e))?;
                }
                "clipboard" | _ => {
                    services::clipboard_paste::insert_text_via_clipboard(&text_to_insert, &app)
                        .map_err(|e| format!("Failed to insert text: {}", e))?;
                }
            }
        }
    } else {
        // No voice commands - insert text directly
        if !formatted.is_empty() {
            match insertion_mode.as_str() {
                "typing" => {
                    services::direct_typing::inject_text_native(&formatted)
                        .map_err(|e| format!("Failed to insert text: {}", e))?;
                }
                "clipboard" | _ => {
                    services::clipboard_paste::insert_text_via_clipboard(&formatted, &app)
                        .map_err(|e| format!("Failed to insert text: {}", e))?;
                }
            }
        }
    }
    
    Ok(formatted)
}

/// Format Whisper transcript (preserve formatting, trim, add space)
fn format_whisper_transcript(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    
    // Add trailing space for natural flow
    format!("{} ", trimmed)
}

/// Normalize Whisper transcript (lowercase + remove punctuation)
fn normalize_whisper_transcript(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    
    // Lowercase and remove punctuation
    let lowercase = trimmed.to_lowercase();
    let cleaned: String = lowercase
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect();
    
    // Add trailing space for natural flow
    format!("{} ", cleaned.trim())
}

/// Execute a voice command action
async fn execute_command_action(action: &CommandAction, app: &AppHandle) -> Result<(), String> {
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
        CommandAction::Rewrite => {
            // Emit event to trigger text rewrite
            if let Some(window) = app.get_webview_window("main") {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                // First select all
                let _ = services::direct_typing::send_key_combo_native("control", "a");
                tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
                // Then trigger rewrite shortcut
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
