use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

// ============================================================================
// ElevenLabs Scribe v2 Realtime Streaming Structures
// ============================================================================

#[derive(Debug, Deserialize)]
struct ElevenLabsMessage {
    message_type: String,
    #[serde(default)]
    text: Option<String>,
    #[serde(default, rename = "session_id")]
    _session_id: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

// ============================================================================
// ElevenLabs WebSocket Streaming
// ============================================================================

/// Start ElevenLabs Scribe v2 realtime streaming session
/// Connects to ElevenLabs WebSocket and returns channels for audio/transcripts
pub async fn start_streaming(
    api_key: String,
    language: Option<String>,
) -> Result<(
    tokio::sync::mpsc::Sender<Vec<u8>>,
    tokio::sync::mpsc::Receiver<String>,
), Box<dyn std::error::Error + Send + Sync>> {
    
    // Build WebSocket URL with query parameters
    let mut url = format!(
        "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000&commit_strategy=vad&vad_silence_threshold_secs=1.0"
    );
    
    // Add language if specified (omit for auto-detect)
    if let Some(lang) = language {
        url.push_str(&format!("&language_code={}", lang));
    }
    
    // Build request with API key in header
    let mut request = url.into_client_request()?;
    request.headers_mut().insert(
        "xi-api-key",
        api_key.parse().unwrap()
    );
    
    // Connect to WebSocket
    let (ws_stream, _response) = connect_async(request).await?;
    let (mut write, mut read) = ws_stream.split();
    
    // Wait for session_started event before proceeding
    let first_msg = read.next().await
        .ok_or("Connection closed before session_started")?
        .map_err(|e| format!("WebSocket error waiting for session_started: {}", e))?;
    
    if let Message::Text(text) = first_msg {
        let event: ElevenLabsMessage = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse session event: {}", e))?;
        if event.message_type != "session_started" {
            return Err(format!("Expected session_started, got: {}", event.message_type).into());
        }
    } else {
        return Err("Expected text message for session_started".into());
    }
    
    // Create channels for communication
    let (audio_tx, mut audio_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);
    let (transcript_tx, transcript_rx) = tokio::sync::mpsc::channel::<String>(100);
    
    // Spawn task to send audio chunks as base64 JSON messages
    tokio::spawn(async move {
        while let Some(audio_data) = audio_rx.recv().await {
            if audio_data.is_empty() {
                // Empty data means close connection - send a final commit to flush remaining audio
                let commit_msg = serde_json::json!({
                    "message_type": "input_audio_chunk",
                    "audio_base_64": "",
                    "commit": true,
                    "sample_rate": 16000
                });
                let _ = write.send(Message::Text(commit_msg.to_string())).await;
                
                // Wait briefly for final transcripts
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                let _ = write.send(Message::Close(None)).await;
                break;
            }
            
            // Encode audio as base64 and send as JSON
            let base64_audio = base64::engine::general_purpose::STANDARD.encode(&audio_data);
            let audio_msg = serde_json::json!({
                "message_type": "input_audio_chunk",
                "audio_base_64": base64_audio,
                "commit": false,
                "sample_rate": 16000
            });
            
            if let Err(_) = write.send(Message::Text(audio_msg.to_string())).await {
                break;
            }
        }
    });
    
    // Spawn task to receive transcripts
    let transcript_tx_clone = transcript_tx.clone();
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Ok(event) = serde_json::from_str::<ElevenLabsMessage>(&text) {
                        // Only forward committed (finalized) transcripts
                        if event.message_type == "committed_transcript" {
                            if let Some(transcript_text) = event.text {
                                let transcript = transcript_text.trim();
                                if !transcript.is_empty() {
                                    if let Err(_) = transcript_tx_clone.send(transcript.to_string()).await {
                                        break;
                                    }
                                }
                            }
                        } else if event.message_type == "error" {
                            if let Some(error) = event.error {
                                eprintln!("[ElevenLabs] Server error: {}", error);
                            }
                        }
                        // Ignore partial_transcript and other message types
                    }
                }
                Ok(Message::Close(_)) => {
                    break;
                }
                Err(_) => {
                    break;
                }
                _ => {}
            }
        }
    });
    
    Ok((audio_tx, transcript_rx))
}
