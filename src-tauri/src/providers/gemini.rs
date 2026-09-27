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
    #[serde(rename = "mimeType")]
    mime_type: String,
    data: String,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
enum ContentPart {
    Text { text: String },
    InlineData {
        #[serde(rename = "inlineData")]
        inline_data: InlineData,
    },
}

#[derive(Debug, Serialize)]
struct Content {
    role: String,
    parts: Vec<ContentPart>,
}

#[derive(Debug, Serialize)]
struct ThinkingConfig {
    #[serde(rename = "thinkingLevel")]
    thinking_level: String,
}

#[derive(Debug, Serialize)]
struct GenerationConfig {
    #[serde(rename = "thinkingConfig")]
    thinking_config: ThinkingConfig,
}

#[derive(Debug, Serialize)]
struct TranscriptionRequest {
    contents: Vec<Content>,
    #[serde(rename = "generationConfig")]
    #[serde(skip_serializing_if = "Option::is_none")]
    generation_config: Option<GenerationConfig>,
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
            role: "user".to_string(),
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
        generation_config: Some(GenerationConfig {
            thinking_config: ThinkingConfig {
                thinking_level: "MINIMAL".to_string(),
            },
        }),
    };
    
    // API key goes in URL query param
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={}",
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

/// Transcribe audio using the specialized Gemini 3.5 Transcribe model via Interactions API
pub async fn transcribe_specialized_verbose(
    audio_data: Vec<u8>,
    api_key: String,
    _language: Option<String>,
    smart_transcription: Option<bool>,
) -> Result<String, Box<dyn std::error::Error>> {
    if audio_data.len() < 100 {
        return Err("Audio data too small".into());
    }
    
    let client = get_http_client();
    
    // Encode audio as base64
    let base64_audio = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &audio_data);
    
    let mode = if smart_transcription.unwrap_or(true) {
        "smart"
    } else {
        "verbatim"
    };

    // Construct request body for Interactions API (no text prompt needed)
    let request_body = serde_json::json!({
        "model": "gemini-3.5-transcribe",
        "input": [
            {
                "type": "audio",
                "data": base64_audio,
                "mime_type": "audio/wav"
            }
        ],
        "generation_config": {
            "transcription_config": {
                "mode": mode
            }
        }
    });
    
    // Interactions API endpoint
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/interactions?key={}",
        urlencoding::encode(&api_key)
    );
    
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("x-goog-api-key", &api_key)
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
    
    let raw_text = response.text().await.map_err(|e| e.to_string())?;
    
    // Parse JSON
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw_text) {
        // 1. Check steps[].content[].text (Interactions API response format)
        if let Some(steps) = v.get("steps").and_then(|s| s.as_array()) {
            let mut combined = String::new();
            for step in steps {
                if let Some(content) = step.get("content").and_then(|c| c.as_array()) {
                    for item in content {
                        if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                            combined.push_str(text);
                        }
                    }
                }
            }
            if !combined.trim().is_empty() {
                return Ok(combined.trim().to_string());
            }
        }

        // 2. Direct output_text from Interactions API
        if let Some(text) = v.get("output_text").and_then(|t| t.as_str()) {
            if !text.trim().is_empty() {
                return Ok(text.trim().to_string());
            }
        }

        // 3. Direct text or transcript field
        if let Some(text) = v.get("text").or_else(|| v.get("transcript")).and_then(|t| t.as_str()) {
            if !text.trim().is_empty() {
                return Ok(text.trim().to_string());
            }
        }

        // 3. outputs array
        if let Some(outputs) = v.get("outputs").and_then(|o| o.as_array()) {
            let mut combined = String::new();
            for out in outputs {
                if let Some(t) = out.get("text").or_else(|| out.get("output_text")).and_then(|s| s.as_str()) {
                    combined.push_str(t);
                }
            }
            if !combined.trim().is_empty() {
                return Ok(combined.trim().to_string());
            }
        }

        // 4. candidates array (fallback)
        let items: Vec<&serde_json::Value> = match v {
            serde_json::Value::Array(ref arr) => arr.iter().collect(),
            _ => vec![&v],
        };
        for item in items {
            if let Some(candidates) = item.get("candidates").and_then(|c| c.as_array()) {
                for candidate in candidates {
                    if let Some(parts) = candidate.get("content").and_then(|c| c.get("parts")).and_then(|p| p.as_array()) {
                        for part in parts {
                            if let Some(text) = part.get("text").and_then(|t| t.as_str()) {
                                if !text.trim().is_empty() {
                                    return Ok(text.trim().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Err(format!("No text in response. Raw response: {}", raw_text).into())
}

// ============================================================================
// Chat Completion Structures
// ============================================================================

#[derive(Debug, Serialize)]
struct ChatContent {
    role: String,
    parts: Vec<ChatPart>,
}

#[derive(Debug, Serialize)]
struct ChatPart {
    text: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    contents: Vec<ChatContent>,
    #[serde(rename = "generationConfig")]
    #[serde(skip_serializing_if = "Option::is_none")]
    generation_config: Option<GenerationConfig>,
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
            role: "user".to_string(),
            parts: vec![
                ChatPart { text: prompt },
                ChatPart { text },
            ],
        }],
        generation_config: Some(GenerationConfig {
            thinking_config: ThinkingConfig {
                thinking_level: "low".to_string(),
            },
        }),
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
