use crate::commands::settings::get_settings;
use crate::providers;
use serde::Serialize;
use tauri::AppHandle;

// ============================================================================
// Text-to-Speech Commands
// ============================================================================

/// Unified audio result returned to the frontend for playback.
/// - LINEAR16: raw PCM, 16-bit signed little-endian, mono at `sample_rate`
/// - MP3: compressed audio, `sample_rate` is 0 (decoded client-side)
#[derive(Debug, Serialize, Clone)]
pub struct TtsAudioResult {
    pub audio_base64: String,
    pub sample_rate: u32,
    pub encoding: String,
    pub duration_seconds: Option<f64>,
}

/// Unified voice description across TTS providers
#[derive(Debug, Serialize, Clone)]
pub struct TtsVoice {
    pub voice_id: String,
    pub name: String,
    pub language: Option<String>,
    pub gender: Option<String>,
    pub accent: Option<String>,
}

/// Synthesize speech for `text` using the configured TTS provider.
/// Provider, API key and voice are read from settings so the same command
/// works from the main window (read-back / speak-selection) and the
/// settings window (voice preview).
#[tauri::command]
pub async fn tts_speak(app: AppHandle, text: String) -> Result<TtsAudioResult, String> {
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return Err("No text to speak".to_string());
    }

    let settings = get_settings(app.clone()).await?;
    let voice_id = settings.tts_voice_id.clone();

    match settings.tts_provider.as_str() {
        "elevenlabs" => {
            if settings.elevenlabs_api_key.trim().is_empty() {
                return Err("ElevenLabs API key is not set".to_string());
            }
            let audio_bytes = providers::tts_elevenlabs::synthesize(
                &trimmed,
                settings.elevenlabs_api_key,
                voice_id,
            )
            .await
            .map_err(|e| format!("ElevenLabs TTS failed: {}", e))?;

            use base64::Engine;
            Ok(TtsAudioResult {
                audio_base64: base64::engine::general_purpose::STANDARD.encode(&audio_bytes),
                sample_rate: 0,
                encoding: "MP3".to_string(),
                duration_seconds: None,
            })
        }
        _ => {
            // Default provider: 60dB
            if settings.sixtydb_api_key.trim().is_empty() {
                return Err("60dB API key is not set".to_string());
            }
            let audio = providers::tts_sixtydb::synthesize(
                &trimmed,
                settings.sixtydb_api_key,
                voice_id,
            )
            .await
            .map_err(|e| format!("60dB TTS failed: {}", e))?;

            Ok(TtsAudioResult {
                audio_base64: audio.audio_base64,
                sample_rate: audio.sample_rate,
                encoding: audio.encoding,
                duration_seconds: audio.duration_seconds,
            })
        }
    }
}

/// Fetch the voice list for a TTS provider.
/// `provider`, `api_key` and `model` optionally override the saved settings
/// so the settings UI can list voices for a key that has not been saved yet.
#[tauri::command]
pub async fn tts_get_voices(
    app: AppHandle,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
) -> Result<Vec<TtsVoice>, String> {
    let settings = get_settings(app.clone()).await?;
    let provider = provider.unwrap_or_else(|| settings.tts_provider.clone());

    match provider.as_str() {
        "elevenlabs" => {
            let key = api_key.unwrap_or_else(|| settings.elevenlabs_api_key.clone());
            if key.trim().is_empty() {
                return Err("ElevenLabs API key is not set".to_string());
            }
            let voices = providers::tts_elevenlabs::get_voices(key)
                .await
                .map_err(|e| format!("Failed to fetch ElevenLabs voices: {}", e))?;

            Ok(voices
                .into_iter()
                .map(|v| TtsVoice {
                    voice_id: v.voice_id,
                    name: v.name,
                    language: v.label("language"),
                    gender: v.label("gender"),
                    accent: v.label("accent"),
                })
                .collect())
        }
        _ => {
            // Default provider: 60dB
            let key = api_key.unwrap_or_else(|| settings.sixtydb_api_key.clone());
            if key.trim().is_empty() {
                return Err("60dB API key is not set".to_string());
            }
            let tier = model.unwrap_or_else(|| settings.tts_model.clone());
            let voices = providers::tts_sixtydb::get_voices(key, tier)
                .await
                .map_err(|e| format!("Failed to fetch 60dB voices: {}", e))?;

            Ok(voices
                .into_iter()
                .map(|v| TtsVoice {
                    voice_id: v.voice_id,
                    name: v.name,
                    language: v.language_name(),
                    gender: v.gender(),
                    accent: v.accent(),
                })
                .collect())
        }
    }
}
