use reqwest::multipart;
use serde::Deserialize;
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
// CrisperWhisper Transcription Structures
// ============================================================================

#[derive(Debug, Deserialize)]
struct CrisperWhisperResponse {
    intended: Option<String>,
    verbatim: Option<String>,
    text: Option<String>,
}

// ============================================================================
// CrisperWhisper Transcription API
// ============================================================================

/// Transcribe audio using Nyra CrisperWhisper API with batch processing
pub async fn transcribe_verbose(
    audio_data: Vec<u8>,
    api_key: String,
    language: Option<String>,
) -> Result<String, Box<dyn std::error::Error>> {
    if audio_data.len() < 100 {
        return Err("Audio data too small".into());
    }

    let client = get_http_client();

    let part = multipart::Part::bytes(audio_data)
        .file_name("segment.wav")
        .mime_str("audio/wav")?;

    let mut form = multipart::Form::new()
        .part("audio", part)
        .text("timestamps", "true");

    let lang_str = language.unwrap_or_else(|| "en".to_string());
    form = form.text("language", lang_str);

    let mut request = client.post("https://nyra-research-dev.com/api/transcribe");

    if !api_key.trim().is_empty() && api_key != "none" && api_key != "default" {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request
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

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status.as_u16(), error_text).into());
    }

    let result: CrisperWhisperResponse = response.json().await?;

    if let Some(intended) = result.intended {
        if !intended.trim().is_empty() {
            return Ok(intended);
        }
    }

    if let Some(verbatim) = result.verbatim {
        if !verbatim.trim().is_empty() {
            return Ok(verbatim);
        }
    }

    if let Some(text) = result.text {
        if !text.trim().is_empty() {
            return Ok(text);
        }
    }

    Err("No text in response".into())
}
