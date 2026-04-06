use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

// ============================================================================
// Voxtral Realtime Streaming Structures
// ============================================================================

#[derive(Debug, Serialize)]
struct SessionUpdate {
    #[serde(rename = "type")]
    msg_type: String,
    session: SessionConfig,
}

#[derive(Debug, Serialize)]
struct SessionConfig {
    audio_format: AudioFormat,
    target_streaming_delay_ms: u32,
}

#[derive(Debug, Serialize)]
struct AudioFormat {
    encoding: String,
    sample_rate: u32,
}

#[derive(Debug, Serialize)]
struct AudioAppend {
    #[serde(rename = "type")]
    msg_type: String,
    audio: String,
}

#[derive(Debug, Serialize)]
struct AudioEnd {
    #[serde(rename = "type")]
    msg_type: String,
}

#[derive(Debug, Deserialize)]
struct VoxtralEvent {
    #[serde(rename = "type")]
    event_type: String,
    text: Option<String>,
}

// ============================================================================
// Voxtral WebSocket Streaming
// ============================================================================

/// Start Voxtral realtime streaming session
/// Connects to Mistral's WebSocket API and returns channels for audio/transcripts
pub async fn start_streaming(
    api_key: String,
) -> Result<(
    tokio::sync::mpsc::Sender<Vec<u8>>,
    tokio::sync::mpsc::Receiver<String>,
), Box<dyn std::error::Error + Send + Sync>> {
    
    let url = "wss://api.mistral.ai/v1/audio/transcriptions/realtime?model=voxtral-mini-transcribe-realtime-2602";
    
    // Build request with Bearer auth header
    let mut request = url.into_client_request()?;
    request.headers_mut().insert(
        "Authorization",
        format!("Bearer {}", api_key).parse().unwrap()
    );
    
    // Connect to WebSocket
    let (ws_stream, _response) = connect_async(request).await?;
    let (mut write, mut read) = ws_stream.split();
    
    // Wait for session.created event before proceeding
    let first_msg = read.next().await
        .ok_or("Connection closed before session.created")?
        .map_err(|e| format!("WebSocket error waiting for session.created: {}", e))?;
    
    if let Message::Text(text) = first_msg {
        let event: VoxtralEvent = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse session event: {}", e))?;
        if event.event_type != "session.created" {
            return Err(format!("Expected session.created, got: {}", event.event_type).into());
        }
    } else {
        return Err("Expected text message for session.created".into());
    }
    
    // Send session.update with audio configuration (fast stream only, 240ms delay)
    let session_update = SessionUpdate {
        msg_type: "session.update".to_string(),
        session: SessionConfig {
            audio_format: AudioFormat {
                encoding: "pcm_s16le".to_string(),
                sample_rate: 16000,
            },
            target_streaming_delay_ms: 240,
        },
    };
    
    write.send(Message::Text(serde_json::to_string(&session_update)?)).await?;
    
    // Create channels for communication
    let (audio_tx, mut audio_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);
    let (transcript_tx, transcript_rx) = tokio::sync::mpsc::channel::<String>(100);
    
    // Spawn task to send audio chunks as base64 JSON messages
    tokio::spawn(async move {
        while let Some(audio_data) = audio_rx.recv().await {
            if audio_data.is_empty() {
                // Empty data means close connection - send input_audio.end
                let end_msg = AudioEnd {
                    msg_type: "input_audio.end".to_string(),
                };
                let _ = write.send(Message::Text(serde_json::to_string(&end_msg).unwrap())).await;
                
                // Wait briefly for final transcripts
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                let _ = write.send(Message::Close(None)).await;
                break;
            }
            
            // Encode audio as base64 and send as JSON
            let base64_audio = base64::engine::general_purpose::STANDARD.encode(&audio_data);
            let audio_msg = AudioAppend {
                msg_type: "input_audio.append".to_string(),
                audio: base64_audio,
            };
            
            if let Err(_) = write.send(Message::Text(serde_json::to_string(&audio_msg).unwrap())).await {
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
                    if let Ok(event) = serde_json::from_str::<VoxtralEvent>(&text) {
                        // Handle transcription text deltas
                        if event.event_type == "transcription.text.delta" {
                            if let Some(transcript_text) = event.text {
                                if !transcript_text.is_empty() {
                                    if let Err(_) = transcript_tx_clone.send(transcript_text).await {
                                        break;
                                    }
                                }
                            }
                        } else if event.event_type == "error" {
                            // Handle errors from the server
                            eprintln!("[Voxtral] Server error: {:?}", event.text);
                            break;
                        }
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
