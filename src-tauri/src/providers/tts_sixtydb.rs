use serde::Deserialize;
use std::sync::OnceLock;

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
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
// 60dB TTS Structures
// ============================================================================

/// Default 60dB voice (documented platform default)
pub const DEFAULT_VOICE_ID: &str = "fbb75ed2-975a-40c7-9e06-38e30524a9a1";

/// LINEAR16 output sample rate (24kHz supported for LINEAR16)
const OUTPUT_SAMPLE_RATE: u32 = 24000;

#[derive(Debug, Deserialize)]
struct SixtyDbTtsResponse {
    success: Option<bool>,
    audio_base64: Option<String>,
    sample_rate: Option<u32>,
    duration_seconds: Option<f64>,
    message: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SixtyDbTtsAudio {
    pub audio_base64: String,
    pub sample_rate: u32,
    pub encoding: String,
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct SixtyDbVoicesResponse {
    data: Option<Vec<SixtyDbVoice>>,
}

#[derive(Debug, Deserialize)]
pub struct SixtyDbVoice {
    pub voice_id: String,
    pub name: String,
    #[serde(default)]
    pub labels: Option<SixtyDbVoiceLabels>,
}

#[derive(Debug, Deserialize)]
pub struct SixtyDbVoiceLabels {
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub language_name: Option<String>,
    #[serde(default)]
    pub gender: Option<String>,
    #[serde(default)]
    pub accent: Option<String>,
}

impl SixtyDbVoice {
    pub fn language_name(&self) -> Option<String> {
        self.labels
            .as_ref()
            .and_then(|l| l.language_name.clone().or_else(|| l.language.clone()))
    }

    pub fn gender(&self) -> Option<String> {
        self.labels.as_ref().and_then(|l| l.gender.clone())
    }

    pub fn accent(&self) -> Option<String> {
        self.labels.as_ref().and_then(|l| l.accent.clone())
    }
}

// ============================================================================
// 60dB Text-to-Speech API
// ============================================================================

/// Synthesize speech using the 60dB TTS REST API (POST /tts-synthesize)
/// Returns base64-encoded LINEAR16 PCM audio at 24kHz
pub async fn synthesize(
    text: &str,
    api_key: String,
    voice_id: String,
) -> Result<SixtyDbTtsAudio, Box<dyn std::error::Error + Send + Sync>> {
    let voice = if voice_id.trim().is_empty() {
        DEFAULT_VOICE_ID.to_string()
    } else {
        voice_id
    };

    let body = serde_json::json!({
        "text": text,
        "voice_id": voice,
        "audio_config": {
            "audio_encoding": "LINEAR16",
            "sample_rate_hertz": OUTPUT_SAMPLE_RATE
        },
        "speed": 1,
        "stability": 50,
        "similarity": 75
    });

    let response = get_http_client()
        .post("https://api.60db.ai/tts-synthesize")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
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

    let result: SixtyDbTtsResponse = response.json().await?;

    if result.success == Some(false) {
        return Err(result
            .message
            .unwrap_or_else(|| "60dB TTS request failed".to_string())
            .into());
    }

    let audio_base64 = result
        .audio_base64
        .filter(|b| !b.is_empty())
        .ok_or("No audio in 60dB TTS response")?;

    Ok(SixtyDbTtsAudio {
        audio_base64,
        sample_rate: result.sample_rate.unwrap_or(OUTPUT_SAMPLE_RATE),
        encoding: "LINEAR16".to_string(),
        duration_seconds: result.duration_seconds,
    })
}

/// Fetch available 60dB voices (GET /voices), filtered by model tier
/// `model` must be "quality" or "fast" (any other value falls back to "quality" server-side)
pub async fn get_voices(
    api_key: String,
    model: String,
) -> Result<Vec<SixtyDbVoice>, Box<dyn std::error::Error + Send + Sync>> {
    let tier = match model.as_str() {
        "fast" => "fast",
        _ => "quality",
    };

    let response = get_http_client()
        .get(format!("https://api.60db.ai/voices?model={}", tier))
        .header("Authorization", format!("Bearer {}", api_key))
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

    let result: SixtyDbVoicesResponse = response.json().await?;

    Ok(result.data.unwrap_or_default())
}
