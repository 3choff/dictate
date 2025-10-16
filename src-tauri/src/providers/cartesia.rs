use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio_tungstenite::{connect_async, tungstenite::Message};

// ============================================================================
// Cartesia Streaming Structures
// ============================================================================

#[derive(Debug, Deserialize)]
struct CartesiaMessage {
    #[serde(rename = "type")]
    msg_type: String,
    text: Option<String>,
    is_final: Option<bool>,
}

// ============================================================================
// Cartesia WebSocket Streaming
// ============================================================================

/// Start Cartesia streaming session
/// Connects to Cartesia WebSocket and returns a channel for sending audio
pub async fn start_streaming(
    api_key: String,
    language: Option<String>,
) -> Result<(
    tokio::sync::mpsc::Sender<Vec<u8>>,
    tokio::sync::mpsc::Receiver<String>,
), Box<dyn std::error::Error + Send + Sync>> {
    
    // Build WebSocket URL with query parameters
    let model = "ink-whisper";
    let encoding = "pcm_s16le";
    let sample_rate = 16000;
    let version = "2025-04-16";
    
    // Build URL with required parameters
    let mut url = format!(
        "wss://api.cartesia.ai/stt/websocket?model={}&encoding={}&sample_rate={}&api_key={}&cartesia_version={}",
        model,
        encoding,
        sample_rate,
        urlencoding::encode(&api_key),
        version
    );
    
    // Add language if specified (omit for multilingual)
    if let Some(lang) = language {
        url.push_str(&format!("&language={}", lang));
    }
    
    // Connect to WebSocket
    let (ws_stream, _response) = connect_async(&url).await?;
    
    let (mut write, mut read) = ws_stream.split();
    
    // Create channels for communication
    let (audio_tx, mut audio_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);
    let (transcript_tx, transcript_rx) = tokio::sync::mpsc::channel::<String>(100);
    
    // Spawn task to send audio chunks to Cartesia
    tokio::spawn(async move {
        while let Some(audio_data) = audio_rx.recv().await {
            if audio_data.is_empty() {
                // Empty data means close connection - send finalize + done
                let _ = write.send(Message::Text("finalize".to_string())).await;
                let _ = write.send(Message::Text("done".to_string())).await;
                let _ = write.send(Message::Close(None)).await;
                break;
            }
            
            if let Err(_) = write.send(Message::Binary(audio_data)).await {
                break;
            }
        }
    });
    
    // Spawn task to receive transcripts from Cartesia
    let transcript_tx_clone = transcript_tx.clone();
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    // Parse Cartesia message
                    if let Ok(ct_msg) = serde_json::from_str::<CartesiaMessage>(&text) {
                        // Check if this is a final transcript
                        if ct_msg.msg_type == "transcript" && ct_msg.is_final.unwrap_or(false) {
                            if let Some(transcript_text) = ct_msg.text {
                                let transcript = transcript_text.trim();
                                if !transcript.is_empty() {
                                    if let Err(_) = transcript_tx_clone.send(transcript.to_string()).await {
                                        break;
                                    }
                                }
                            }
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
