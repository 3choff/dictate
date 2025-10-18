use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

// ============================================================================
// Deepgram Streaming Structures
// ============================================================================

#[derive(Debug, Deserialize)]
struct DeepgramAlternative {
    transcript: String,
}

#[derive(Debug, Deserialize)]
struct DeepgramChannel {
    alternatives: Vec<DeepgramAlternative>,
}

#[derive(Debug, Deserialize)]
struct DeepgramMessage {
    #[serde(rename = "type")]
    msg_type: String,
    is_final: Option<bool>,
    speech_final: Option<bool>,
    channel: Option<DeepgramChannel>,
}

// ============================================================================
// Deepgram WebSocket Streaming
// ============================================================================

/// Start Deepgram streaming session
/// Connects to Deepgram WebSocket and returns a channel for sending audio
pub async fn start_streaming(
    api_key: String,
    language: String,
    smart_format: bool,
    encoding: Option<String>,
) -> Result<(
    tokio::sync::mpsc::Sender<Vec<u8>>,
    tokio::sync::mpsc::Receiver<String>,
), Box<dyn std::error::Error + Send + Sync>> {
    
    // Build WebSocket URL with query parameters (no token in URL)
    let enc = encoding.unwrap_or_else(|| "opus".to_string());
    
    // When smart_format is false, punctuate should also be false (no formatting)
    // When smart_format is true, punctuate should be true (full formatting)
    // Add sample_rate for raw audio formats like linear16
    let url = if enc == "linear16" {
        format!(
            "wss://api.deepgram.com/v1/listen?model=nova-3&language={}&punctuate={}&smart_format={}&interim_results=false&endpointing=100&encoding={}&sample_rate=16000",
            language,
            smart_format,  // punctuate matches smart_format
            smart_format,
            enc
        )
    } else {
        format!(
            "wss://api.deepgram.com/v1/listen?model=nova-3&language={}&punctuate={}&smart_format={}&interim_results=false&endpointing=100&encoding={}",
            language,
            smart_format,  // punctuate matches smart_format
            smart_format,
            enc
        )
    };
    
    // Create WebSocket request with subprotocol authentication (like Electron: ['token', apiKey])
    let mut request = url.into_client_request()?;
    
    // Add Sec-WebSocket-Protocol header with 'token' and the API key
    request.headers_mut().insert(
        "Sec-WebSocket-Protocol",
        format!("token, {}", api_key).parse().unwrap()
    );
    
    // Connect to WebSocket with authentication
    let (ws_stream, _response) = connect_async(request).await?;
    
    let (mut write, mut read) = ws_stream.split();
    
    // Create channels for communication
    let (audio_tx, mut audio_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);
    let (transcript_tx, transcript_rx) = tokio::sync::mpsc::channel::<String>(100);
    
    // Spawn task to send audio chunks to Deepgram
    tokio::spawn(async move {
        while let Some(audio_data) = audio_rx.recv().await {
            if audio_data.is_empty() {
                // Empty data means close connection
                let _ = write.send(Message::Close(None)).await;
                break;
            }
            
            if let Err(_) = write.send(Message::Binary(audio_data)).await {
                break;
            }
        }
    });
    
    // Spawn task to receive transcripts from Deepgram
    let transcript_tx_clone = transcript_tx.clone();
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    // Parse Deepgram message
                    if let Ok(dg_msg) = serde_json::from_str::<DeepgramMessage>(&text) {
                        // Check if this is a final transcript
                        let is_final = dg_msg.is_final.unwrap_or(false) 
                                    || dg_msg.speech_final.unwrap_or(false);
                        
                        if is_final && dg_msg.msg_type == "Results" {
                            if let Some(channel) = dg_msg.channel {
                                if let Some(alt) = channel.alternatives.first() {
                                    let transcript = alt.transcript.trim();
                                    if !transcript.is_empty() {
                                        if let Err(_) = transcript_tx_clone.send(transcript.to_string()).await {
                                            break;
                                        }
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
