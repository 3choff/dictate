use reqwest::multipart;
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

#[derive(Debug, Deserialize)]
struct GroqResponse {
    text: String,
}

#[derive(Debug, Deserialize)]
struct GroqVerboseResponse {
    text: String,
    // Add other fields if needed in the future
    // language: Option<String>,
    // duration: Option<f64>,
}

/// Transcribe audio using Groq Whisper API
/// Returns simple text response
pub async fn transcribe(audio_data: Vec<u8>, api_key: String) -> Result<String, Box<dyn std::error::Error>> {
    let client = get_http_client();
    
    let part = multipart::Part::bytes(audio_data)
        .file_name("audio.wav")
        .mime_str("audio/wav")?;
    
    let form = multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-large-v3-turbo")
        .text("response_format", "json");
    
    let response = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await?;
    
    let result: GroqResponse = response.json().await?;
    Ok(result.text)
}

/// Transcribe audio with verbose_json format (matches Electron implementation)
/// Supports optional language parameter
pub async fn transcribe_verbose(
    audio_data: Vec<u8>,
    api_key: String,
    language: Option<String>,
) -> Result<String, Box<dyn std::error::Error>> {
    // Validate audio data
    if audio_data.len() < 100 {
        return Err("Audio data too small".into());
    }
    
    let client = get_http_client();
    
    // Create multipart form
    let part = multipart::Part::bytes(audio_data)
        .file_name("output.wav")
        .mime_str("audio/wav")?;
    
    let mut form = multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-large-v3-turbo")
        .text("response_format", "verbose_json");
    
    // Add language if specified
    if let Some(lang) = language {
        form = form.text("language", lang);
    }
    
    let response = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
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
    
    let result: GroqVerboseResponse = response.json().await?;
    Ok(result.text)
}

// Chat completion structures
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
    top_p: f32,
    stream: bool,
    max_completion_tokens: u32,
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

/// Rewrite text using Groq chat completions API
/// Matches the JavaScript implementation
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
        model: "llama-3.3-70b-versatile".to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: format!("{}\n\n{}", prompt, text),
        }],
        temperature: 0.2,
        top_p: 1.0,
        stream: false,
        max_completion_tokens: 1024,
    };
    
    let response = client
        .post("https://api.groq.com/openai/v1/chat/completions")
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
