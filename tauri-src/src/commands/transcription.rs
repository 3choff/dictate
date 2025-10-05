use crate::providers;
use crate::services;

#[tauri::command]
pub async fn transcribe_audio(audio_data: Vec<u8>, api_key: String) -> Result<String, String> {
    // Validate inputs
    if audio_data.is_empty() {
        return Err("No audio data provided".to_string());
    }
    
    if api_key.trim().is_empty() {
        return Err("API key is not set. Please configure it in settings.".to_string());
    }
    
    providers::groq::transcribe(audio_data, api_key)
        .await
        .map_err(|e| e.to_string())
}

/// Transcribe audio segment and insert text immediately (for Groq segmentation)
#[tauri::command]
pub async fn transcribe_audio_segment(
    audio_data: Vec<u8>,
    api_key: String,
    insertion_mode: String,
    language: Option<String>,
    text_formatted: Option<bool>,
) -> Result<String, String> {
    // Validate inputs
    if audio_data.is_empty() {
        return Err("No audio data provided".to_string());
    }
    
    if api_key.trim().is_empty() {
        return Err("API key is not set".to_string());
    }
    
    // Normalize language: 'multilingual' or empty -> None (auto-detect)
    let groq_lang = match language.as_deref() {
        None => None,
        Some("") => None,
        Some("multilingual") => None,
        Some(code) => Some(code.to_string()),
    };

    // Transcribe using verbose format
    let text = providers::groq::transcribe_verbose(audio_data, api_key, groq_lang)
        .await
        .map_err(|e| {
            let error_msg = e.to_string();
            
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
    
    // Insert text immediately if not empty
    if !formatted.is_empty() {
        match insertion_mode.as_str() {
            "typing" => {
                services::keyboard_inject::inject_text_native(&formatted)
                    .map_err(|e| format!("Failed to insert text: {}", e))?;
            }
            "clipboard" | _ => {
                services::keyboard::insert_text_via_clipboard(&formatted)
                    .map_err(|e| format!("Failed to insert text: {}", e))?;
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
