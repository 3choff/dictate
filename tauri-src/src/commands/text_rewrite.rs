use crate::providers;
use tauri::AppHandle;

/// Correct grammar using the selected provider from settings
/// This command loads both the provider selection and API key from settings
#[tauri::command]
pub async fn correct_grammar(app: AppHandle, text: String, api_key: String) -> Result<String, String> {
    // Validate inputs
    if text.trim().is_empty() {
        return Err("No text provided".to_string());
    }
    
    // Load settings to get grammar provider and prompt
    let settings = crate::commands::settings::get_settings(app)
        .await
        .map_err(|e| format!("Failed to load settings: {}", e))?;
    
    // Get the grammar correction prompt from settings
    let prompt = settings
        .prompts
        .get("grammar_correction")
        .ok_or("Grammar correction prompt not found in settings")?
        .clone();
    
    // Get selected grammar provider (default: groq)
    let provider = &settings.grammar_provider;
    
    // Get the appropriate API key for the selected provider
    let provider_api_key = match provider.as_str() {
        "sambanova" => &settings.sambanova_api_key,
        "fireworks" => &settings.fireworks_api_key,
        _ => &settings.groq_api_key,  // Default to groq
    };
    
    // Use the provider's key if available, otherwise fall back to the passed key (for backward compatibility)
    let active_key = if !provider_api_key.trim().is_empty() {
        provider_api_key
    } else {
        &api_key
    };
    
    if active_key.trim().is_empty() {
        return Err("API key is not set".to_string());
    }
    
    // Route to the selected provider
    let result = match provider.as_str() {
        "sambanova" => providers::sambanova::rewrite_text(text, prompt, active_key.to_string()).await,
        "fireworks" => providers::fireworks::rewrite_text(text, prompt, active_key.to_string()).await,
        _ => providers::groq::rewrite_text(text, prompt, active_key.to_string()).await,
    };
    
    // Map errors to user-friendly messages
    result.map_err(|e| {
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
