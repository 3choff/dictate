use base64::Engine;
use futures_util::{SinkExt, StreamExt, stream::SplitSink, stream::SplitStream};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream};
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
// Voxtral WebSocket Connection Helper
// ============================================================================

type WsSink = SplitSink<tokio_tungstenite::WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>, Message>;
type WsStream = SplitStream<tokio_tungstenite::WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>>;

/// Connect to Voxtral's WebSocket, wait for session.created, send session.update, and return
/// the split write/read halves ready for use.
async fn connect_voxtral_stream(
    api_key: &str,
    delay_ms: u32,
) -> Result<(WsSink, WsStream), Box<dyn std::error::Error + Send + Sync>> {
    let url = "wss://api.mistral.ai/v1/audio/transcriptions/realtime?model=voxtral-mini-transcribe-realtime-2602";

    let mut request = url.into_client_request()?;
    request.headers_mut().insert(
        "Authorization",
        format!("Bearer {}", api_key).parse().unwrap()
    );

    let (ws_stream, _response) = connect_async(request).await?;
    let (mut write, mut read) = ws_stream.split();

    // Wait for session.created
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

    // Send session.update with audio config and delay
    let session_update = SessionUpdate {
        msg_type: "session.update".to_string(),
        session: SessionConfig {
            audio_format: AudioFormat {
                encoding: "pcm_s16le".to_string(),
                sample_rate: 16000,
            },
            target_streaming_delay_ms: delay_ms,
        },
    };
    write.send(Message::Text(serde_json::to_string(&session_update)?)).await?;

    Ok((write, read))
}

/// Spawn a receive task that forwards transcription deltas to a channel.
fn spawn_receive_task(
    mut read: WsStream,
    tx: tokio::sync::mpsc::Sender<String>,
    stream_name: &'static str,
) {
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Ok(event) = serde_json::from_str::<VoxtralEvent>(&text) {
                        if event.event_type == "transcription.text.delta" {
                            if let Some(transcript_text) = event.text {
                                if !transcript_text.is_empty() {
                                    if let Err(_) = tx.send(transcript_text).await {
                                        break;
                                    }
                                }
                            }
                        } else if event.event_type == "error" {
                            eprintln!("[Voxtral/{}] Server error: {:?}", stream_name, event.text);
                            break;
                        }
                    }
                }
                Ok(Message::Close(_)) => break,
                Err(_) => break,
                _ => {}
            }
        }
    });
}

// ============================================================================
// Voxtral WebSocket Streaming (Public API)
// ============================================================================

/// Start Voxtral realtime streaming session.
///
/// Opens a connection to Voxtral's realtime STT endpoint configured for
/// low latency (240ms) and returns channels to pipe audio in and transcript out.
///
/// Returns: (audio_tx, transcript_rx)
pub async fn start_streaming(
    api_key: String,
) -> Result<(
    tokio::sync::mpsc::Sender<Vec<u8>>,
    tokio::sync::mpsc::Receiver<String>,
), Box<dyn std::error::Error + Send + Sync>> {

    // Open the fast stream
    let (mut ws_write, ws_read) = connect_voxtral_stream(&api_key, 240).await?;

    let (audio_tx, mut audio_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);
    let (transcript_tx, transcript_rx) = tokio::sync::mpsc::channel::<String>(100);

    spawn_receive_task(ws_read, transcript_tx, "fast");

    // Spawn audio send task
    tokio::spawn(async move {
        while let Some(audio_data) = audio_rx.recv().await {
            if audio_data.is_empty() {
                let end_msg = serde_json::to_string(&AudioEnd {
                    msg_type: "input_audio.end".to_string(),
                }).unwrap();
                let _ = ws_write.send(Message::Text(end_msg)).await;

                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                let _ = ws_write.send(Message::Close(None)).await;
                break;
            }

            let base64_audio = base64::engine::general_purpose::STANDARD.encode(&audio_data);
            let audio_msg = serde_json::to_string(&AudioAppend {
                msg_type: "input_audio.append".to_string(),
                audio: base64_audio,
            }).unwrap();

            if let Err(_) = ws_write.send(Message::Text(audio_msg)).await {
                break;
            }
        }
    });

    Ok((audio_tx, transcript_rx))
}
