use crate::providers;
use tauri::AppHandle;

#[tauri::command]
pub async fn correct_grammar(app: AppHandle, text: String, api_key: String) -> Result<String, String> {
    // Validate inputs
    if text.trim().is_empty() {
        return Err("No text provided".to_string());
    }
    
    if api_key.trim().is_empty() {
        return Err("API key is not set".to_string());
    }
    
    // Get settings to retrieve the grammar correction prompt
    let settings = crate::commands::settings::get_settings(app)
        .await
        .map_err(|e| format!("Failed to load settings: {}", e))?;
    
    // Get the grammar correction prompt from settings
    let prompt = settings
        .prompts
        .get("grammar_correction")
        .ok_or("Grammar correction prompt not found in settings")?
        .clone();
    
    // Call Groq API to rewrite the text
    providers::groq::rewrite_text(text, prompt, api_key)
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
                format!("Grammar correction failed: {}", error_msg)
            }
        })
}
