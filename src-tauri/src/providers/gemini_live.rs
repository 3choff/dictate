use base64::Engine;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

// ============================================================================
// Gemini Live Event Parsing
// ============================================================================

enum GeminiLiveEvent {
    Interim(String),
    Final(String),
}

fn parse_gemini_live_message(data: &[u8]) -> Option<GeminiLiveEvent> {
    let text = std::str::from_utf8(data).ok()?;
    let v: serde_json::Value = serde_json::from_str(text.trim()).ok()?;
    
    if let Some(server_content) = v.get("serverContent") {
        // 1. Check for finalized transcription (inputTranscription)
        if let Some(input_transcription) = server_content.get("inputTranscription") {
            if let Some(final_text) = input_transcription.get("text").and_then(|t| t.as_str()) {
                let trimmed = final_text.trim();
                if !trimmed.is_empty() {
                    return Some(GeminiLiveEvent::Final(trimmed.to_string()));
                }
            }
        }
        
        // 2. Check for interim live transcription (interimInputTranscription)
        if let Some(interim) = server_content.get("interimInputTranscription") {
            if let Some(interim_text) = interim.get("text").and_then(|t| t.as_str()) {
                let trimmed = interim_text.trim();
                if !trimmed.is_empty() {
                    return Some(GeminiLiveEvent::Interim(trimmed.to_string()));
                }
            }
        }
        
        // 3. Check for modelTurn (fallback for multimodal content)
        if let Some(model_turn) = server_content.get("modelTurn") {
            if let Some(parts) = model_turn.get("parts").and_then(|p| p.as_array()) {
                let mut combined = String::new();
                for part in parts {
                    if let Some(t) = part.get("text").and_then(|s| s.as_str()) {
                        combined.push_str(t);
                    }
                }
                let trimmed = combined.trim();
                if !trimmed.is_empty() {
                    if server_content.get("turnComplete").and_then(|t| t.as_bool()).unwrap_or(false) {
                        return Some(GeminiLiveEvent::Final(trimmed.to_string()));
                    } else {
                        return Some(GeminiLiveEvent::Interim(trimmed.to_string()));
                    }
                }
            }
        }
    }
    
    None
}

// ============================================================================
// Gemini Live WebSocket Streaming
// ============================================================================

/// Start Gemini Live streaming session
/// Connects to Gemini BidiGenerateContent WebSocket and returns channels for audio and transcription
pub async fn start_streaming(
    api_key: String,
    _language: Option<String>,
    smart_transcription: Option<bool>,
) -> Result<(
    tokio::sync::mpsc::Sender<Vec<u8>>,
    tokio::sync::mpsc::Receiver<String>,
    tokio::sync::mpsc::Receiver<String>,
), Box<dyn std::error::Error + Send + Sync>> {
    
    // WebSocket endpoint for BidiGenerateContent
    let url = format!(
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={}",
        urlencoding::encode(&api_key)
    );
    
    let request = url.into_client_request()?;
    let (ws_stream, _response) = connect_async(request).await?;
    let (mut write, mut read) = ws_stream.split();
    
    let mode = if smart_transcription.unwrap_or(true) {
        "SMART"
    } else {
        "VERBATIM"
    };

    // Send initial setup message to initialize the session
    let setup_msg = serde_json::json!({
        "setup": {
            "model": "models/gemini-3.5-transcribe-live",
            "generationConfig": {
                "responseModalities": ["TEXT"]
            },
            "inputAudioTranscription": {
                "mode": mode
            }
        }
    });
    
    write.send(Message::Text(serde_json::to_string(&setup_msg)?)).await?;
    
    // Create channels for communication
    let (audio_tx, mut audio_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);
    let (transcript_tx, transcript_rx) = tokio::sync::mpsc::channel::<String>(100);
    let (partial_tx, partial_rx) = tokio::sync::mpsc::channel::<String>(100);
    
    // Spawn task to send audio chunks to Gemini Live
    tokio::spawn(async move {
        while let Some(audio_data) = audio_rx.recv().await {
            if audio_data.is_empty() {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                let _ = write.send(Message::Close(None)).await;
                break;
            }
            
            let base64_audio = base64::engine::general_purpose::STANDARD.encode(&audio_data);
            let input_msg = serde_json::json!({
                "realtimeInput": {
                    "mediaChunks": [
                        {
                            "mimeType": "audio/pcm;rate=16000",
                            "data": base64_audio
                        }
                    ]
                }
            });
            
            if let Ok(json_str) = serde_json::to_string(&input_msg) {
                if let Err(_) = write.send(Message::Text(json_str)).await {
                    break;
                }
            }
        }
    });
    
    // Spawn task to receive real-time transcripts from Gemini Live
    let transcript_tx_clone = transcript_tx.clone();
    let partial_tx_clone = partial_tx.clone();
    
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Binary(bin)) => {
                    if let Some(event) = parse_gemini_live_message(&bin) {
                        match event {
                            GeminiLiveEvent::Interim(interim_text) => {
                                let _ = partial_tx_clone.send(interim_text).await;
                            }
                            GeminiLiveEvent::Final(final_text) => {
                                let _ = transcript_tx_clone.send(final_text).await;
                            }
                        }
                    }
                }
                Ok(Message::Text(text)) => {
                    if let Some(event) = parse_gemini_live_message(text.as_bytes()) {
                        match event {
                            GeminiLiveEvent::Interim(interim_text) => {
                                let _ = partial_tx_clone.send(interim_text).await;
                            }
                            GeminiLiveEvent::Final(final_text) => {
                                let _ = transcript_tx_clone.send(final_text).await;
                            }
                        }
                    }
                }
                Ok(Message::Close(_)) => {
                    break;
                }
                Err(e) => {
                    eprintln!("[Gemini Live WS] Receive error: {:?}", e);
                    break;
                }
                _ => {}
            }
        }
    });
    
    Ok((audio_tx, transcript_rx, partial_rx))
}
