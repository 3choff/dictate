use crate::providers;

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
