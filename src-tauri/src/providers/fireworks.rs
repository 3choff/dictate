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
struct WhisperSegment {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WhisperResponse {
    text: Option<String>,
    segments: Option<Vec<WhisperSegment>>,
}

// ============================================================================
// Whisper Transcription API
// ============================================================================

/// Transcribe audio using Fireworks Whisper API with batch processing
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

    // Create multipart form
    let part = multipart::Part::bytes(audio_data)
        .file_name("segment.wav")
        .mime_str("audio/wav")?;

    let mut form = multipart::Form::new()
        .part("file", part)
        .text("vad_model", "silero")
        .text("alignment_model", "tdnn_ffn")
        .text("response_format", "json")
        .text("preprocessing", "none")
        .text("temperature", "0,0.2,0.4,0.6,0.8,1")
        .text("timestamp_granularities", "segment");

    // Add language if specified
    if let Some(lang) = language {
        form = form.text("language", lang);
    }

    let response = client
        .post("https://audio-prod.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
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

    let result: WhisperResponse = response.json().await?;

    // Try to extract text from response
    if let Some(txt) = result.text {
        if !txt.trim().is_empty() {
            return Ok(txt);
        }
    }
    
    // Fallback: check segments array
    if let Some(segments) = result.segments {
        for segment in segments {
            if let Some(t) = segment.text {
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
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    top_p: f32,
    top_k: u32,
    presence_penalty: f32,
    frequency_penalty: f32,
    temperature: f32,
    stream: bool,
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
// Chat Completion API
// ============================================================================

/// Rewrite text using Fireworks chat completions API
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
    let request_body = ChatCompletionRequest {
        model: "accounts/fireworks/models/gpt-oss-20b".to_string(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: prompt,
            },
            ChatMessage {
                role: "user".to_string(),
                content: text,
            },
        ],
        max_tokens: 1024,
        top_p: 1.0,
        top_k: 40,
        presence_penalty: 0.0,
        frequency_penalty: 0.0,
        temperature: 0.6,
        stream: false,
    };
    
    let response = client
        .post("https://api.fireworks.ai/inference/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
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
