use crate::providers;
use crate::services;

/// Transcribe audio segment and insert text immediately
/// Supports multiple providers (Groq, SambaNova) with batch audio processing
#[tauri::command]
pub async fn transcribe_audio_segment(
    audio_data: Vec<u8>,
    api_key: String,
    insertion_mode: String,
    language: Option<String>,
    text_formatted: Option<bool>,
    api_service: Option<String>,
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
