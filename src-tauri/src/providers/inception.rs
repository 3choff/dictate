use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

// Reusable HTTP client with connection pooling
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .tcp_keepalive(std::time::Duration::from_secs(60))
            .http2_keep_alive_interval(std::time::Duration::from_secs(30))
            .http2_keep_alive_timeout(std::time::Duration::from_secs(20))
            .build()
            .expect("Failed to create HTTP client")
    })
}

// ============================================================================
// Chat Completion Structures (OpenAI-compatible)
// ============================================================================

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
    reasoning_effort: String,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessageResponse,
}

#[derive(Debug, Deserialize)]
struct ChatMessageResponse {
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

// ============================================================================
// Chat Completion API (Mercury 2)
// ============================================================================

/// Rewrite text using Inception Mercury 2 model
/// Uses OpenAI-compatible API at api.inceptionlabs.ai
pub async fn rewrite_text(
    text: String,
    prompt: String,
    api_key: String,
) -> Result<String, Box<dyn std::error::Error>> {
    // Validate inputs
    if prompt.trim().is_empty() {
        return Err("Prompt is required".into());
    }
    
    if text.trim().is_empty() {
        return Err("Text is required".into());
    }
    
    let client = get_http_client();
    
    // Construct the request body
    let request_body = ChatCompletionRequest {
        model: "mercury-2".to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: format!("{}\n\n{}", prompt, text),
        }],
        temperature: 0.6,
        max_tokens: 1024,
        reasoning_effort: "instant".to_string(),
    };
    
    let response = client
        .post("https://api.inceptionlabs.ai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Request timeout".into()
            } else if e.is_connect() {
                "Connection failed - check internet".into()
            } else {
                Box::new(e) as Box<dyn std::error::Error>
            }
        })?;
    
    // Check status code
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status.as_u16(), error_text).into());
    }
    
    let result: ChatCompletionResponse = response.json().await?;
    
    // Extract content from first choice
    if let Some(choice) = result.choices.first() {
        let content = choice.message.content.trim();
        if !content.is_empty() {
            return Ok(content.to_string());
        }
    }
    
    Err("No content in response".into())
}
