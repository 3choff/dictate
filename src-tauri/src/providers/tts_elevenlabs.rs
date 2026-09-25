use serde::Deserialize;
use std::collections::HashMap;
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
// ElevenLabs TTS Structures
// ============================================================================

/// Default ElevenLabs voice ("Rachel") used when no voice is configured
pub const DEFAULT_VOICE_ID: &str = "21m00Tcm4TlvDq8ikWAM";

const TTS_MODEL: &str = "eleven_multilingual_v2";

#[derive(Debug, Deserialize)]
struct ElevenLabsVoicesResponse {
    voices: Option<Vec<ElevenLabsVoice>>,
}

#[derive(Debug, Deserialize)]
pub struct ElevenLabsVoice {
    pub voice_id: String,
    pub name: String,
    /// Free-form labels: language, gender, accent, use_case, ...
    #[serde(default)]
    pub labels: Option<HashMap<String, String>>,
}

impl ElevenLabsVoice {
    pub fn label(&self, key: &str) -> Option<String> {
        self.labels.as_ref().and_then(|l| l.get(key).cloned())
    }
}

// ============================================================================
// ElevenLabs Text-to-Speech API
// ============================================================================

/// Synthesize speech using the ElevenLabs TTS API
/// (POST /v1/text-to-speech/{voice_id}) and return raw MP3 bytes
pub async fn synthesize(
    text: &str,
    api_key: String,
    voice_id: String,
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    let voice = if voice_id.trim().is_empty() {
        DEFAULT_VOICE_ID.to_string()
    } else {
        voice_id
    };

    let body = serde_json::json!({
        "text": text,
        "model_id": TTS_MODEL,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "speed": 1.0
        }
    });

    let response = get_http_client()
        .post(format!(
            "https://api.elevenlabs.io/v1/text-to-speech/{}?output_format=mp3_44100_128",
            voice
        ))
        .header("xi-api-key", api_key)
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

    let audio_bytes = response.bytes().await?;
    if audio_bytes.is_empty() {
        return Err("No audio in ElevenLabs TTS response".into());
    }

    Ok(audio_bytes.to_vec())
}

/// Fetch available ElevenLabs voices (GET /v1/voices)
pub async fn get_voices(
    api_key: String,
) -> Result<Vec<ElevenLabsVoice>, Box<dyn std::error::Error + Send + Sync>> {
    let response = get_http_client()
        .get("https://api.elevenlabs.io/v1/voices")
        .header("xi-api-key", api_key)
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

    let result: ElevenLabsVoicesResponse = response.json().await?;

    Ok(result.voices.unwrap_or_default())
}
