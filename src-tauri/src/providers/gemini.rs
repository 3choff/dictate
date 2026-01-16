use reqwest;
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

#[derive(Debug, Serialize)]
struct InlineData {
    mime_type: String,
    data: String,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum ContentPart {
    Text { text: String },
    InlineData { inline_data: InlineData },
}

#[derive(Debug, Serialize)]
struct Content {
    parts: Vec<ContentPart>,
}

#[derive(Debug, Serialize)]
struct TranscriptionRequest {
    contents: Vec<Content>,
}

#[derive(Debug, Deserialize)]
struct ResponsePart {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ResponseContent {
    parts: Option<Vec<ResponsePart>>,
}

#[derive(Debug, Deserialize)]
struct Candidate {
    content: Option<ResponseContent>,
}

#[derive(Debug, Deserialize)]
struct TranscriptionResponse {
    candidates: Option<Vec<Candidate>>,
}

// ============================================================================
// Whisper Transcription API
// ============================================================================

/// Transcribe audio using Gemini Flash Lite with batch processing
/// Supports optional language parameter for better accuracy
pub async fn transcribe_verbose(
    audio_data: Vec<u8>,
    api_key: String,
    _language: Option<String>,
) -> Result<String, Box<dyn std::error::Error>> {
    if audio_data.len() < 100 {
        return Err("Audio data too small".into());
    }
    
    let client = get_http_client();
    
    // Encode audio as base64
    let base64_audio = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &audio_data);
    
    // Construct request body
    let request_body = TranscriptionRequest {
        contents: vec![Content {
            parts: vec![
                ContentPart::Text {
                    text: "Generate a transcript of the speech.".to_string(),
                },
                ContentPart::InlineData {
                    inline_data: InlineData {
                        mime_type: "audio/wav".to_string(),
                        data: base64_audio,
                    },
                },
            ],
        }],
    };
    
    // API key goes in URL query param
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={}",
        urlencoding::encode(&api_key)
    );
    
    let response = client
        .post(&url)
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
    
    let result: TranscriptionResponse = response.json().await?;
    
    // Extract text from candidates
    if let Some(candidates) = result.candidates {
        for candidate in candidates {
            if let Some(content) = candidate.content {
                if let Some(parts) = content.parts {
                    for part in parts {
                        if let Some(text) = part.text {
                            if !text.trim().is_empty() {
                                return Ok(text);
                            }
                        }
                    }
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
struct ChatContent {
    parts: Vec<ChatPart>,
}

#[derive(Debug, Serialize)]
struct ChatPart {
    text: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    contents: Vec<ChatContent>,
}

// ============================================================================
// Chat Completion API
// ============================================================================

/// Rewrite text using a specified Gemini model
/// Used for text rewriting and transformation
pub async fn rewrite_text(
    text: String,
    prompt: String,
    api_key: String,
    model: String,
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
        contents: vec![ChatContent {
            parts: vec![
                ChatPart { text: prompt },
                ChatPart { text },
            ],
        }],
    };
    
    // API key goes in URL query param
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model,
        urlencoding::encode(&api_key)
    );
    
    let response = client
        .post(&url)
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
    
    let result: TranscriptionResponse = response.json().await?;
    
    // Extract text from candidates
    if let Some(candidates) = result.candidates {
        for candidate in candidates {
            if let Some(content) = candidate.content {
                if let Some(parts) = content.parts {
                    for part in parts {
                        if let Some(text) = part.text {
                            let trimmed = text.trim();
                            if !trimmed.is_empty() {
                                return Ok(trimmed.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    
    Err("No content in response".into())
}
