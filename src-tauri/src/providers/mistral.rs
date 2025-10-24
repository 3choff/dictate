use reqwest::multipart;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

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
// Whisper Transcription Structures
// ============================================================================

#[derive(Debug, Deserialize)]
struct TranscriptionResult {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TranscriptionResponse {
    text: Option<String>,
    results: Option<Vec<TranscriptionResult>>,
}

// ============================================================================
// Whisper Transcription API
// ============================================================================

/// Transcribe audio using Mistral Voxtral with batch processing
/// Supports optional language parameter for better accuracy
pub async fn transcribe_verbose(
    audio_data: Vec<u8>,
    api_key: String,
    language: Option<String>,
) -> Result<String, Box<dyn std::error::Error>> {
    if audio_data.len() < 100 {
        return Err("Audio data too small".into());
    }
    
    let client = get_http_client();
    
    // Mistral uses voxtral-mini-2507 model
    let model_name = "voxtral-mini-2507";

    // Create multipart form
    let part = multipart::Part::bytes(audio_data)
        .file_name("segment.wav")
        .mime_str("audio/wav")?;

    let mut form = multipart::Form::new()
        .part("file", part)
        .text("model", model_name);

    // Add language if specified
    if let Some(lang) = language {
        form = form.text("language", lang);
    }

    let response = client
        .post("https://api.mistral.ai/v1/audio/transcriptions")
        .header("x-api-key", api_key)  // Mistral uses x-api-key header
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Request timeout".to_string()
            } else if e.is_connect() {
                "Connection failed - check internet".to_string()
            } else {
                e.to_string()
            }
        })?;

    // Check status code
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status.as_u16(), error_text).into());
    }

    let result: TranscriptionResponse = response.json().await?;

    // Try to extract text from response
    if let Some(txt) = result.text {
        if !txt.trim().is_empty() {
            return Ok(txt);
        }
    }
    
    // Fallback: check results array
    if let Some(results) = result.results {
        for r in results {
            if let Some(t) = r.text {
                if !t.trim().is_empty() {
                    return Ok(t);
                }
            }
        }
    }

    Err("No text in response".into())
}

// ============================================================================
// Chat Completion Structures
// ============================================================================

#[derive(Debug, Serialize)]
struct ChatInput {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct CompletionArgs {
    temperature: f32,
    max_tokens: u32,
    top_p: f32,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    inputs: Vec<ChatInput>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<String>,
    completion_args: CompletionArgs,
    stream: bool,
    instructions: String,
}

#[derive(Debug, Deserialize)]
struct ChatOutput {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    outputs: Option<Vec<ChatOutput>>,
}

// ============================================================================
// Chat Completion API
// ============================================================================

/// Rewrite text using Mistral conversations API
/// Used for text rewriting and transformation
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
    let request_body = ChatRequest {
        model: "mistral-small-latest".to_string(),
        inputs: vec![ChatInput {
            role: "user".to_string(),
            content: format!("{}\n\n{}", prompt, text),
        }],
        tools: vec![],
        completion_args: CompletionArgs {
            temperature: 0.2,
            max_tokens: 1024,
            top_p: 1.0,
        },
        stream: false,
        instructions: String::new(),
    };
    
    let response = client
        .post("https://api.mistral.ai/v1/conversations")
        .header("x-api-key", api_key)  // Mistral uses x-api-key header
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Request timeout".to_string()
            } else if e.is_connect() {
                "Connection failed - check internet".to_string()
            } else {
                e.to_string()
            }
        })?;
    
    // Check status code
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status.as_u16(), error_text).into());
    }
    
    let result: ChatResponse = response.json().await?;
    
    // Extract content from outputs array
    if let Some(outputs) = result.outputs {
        for output in outputs {
            if let Some(content) = output.content {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return Ok(trimmed.to_string());
                }
            }
        }
    }
    
    Err("No content in response".into())
}
