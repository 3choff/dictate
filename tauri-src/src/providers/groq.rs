use reqwest::multipart;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct GroqResponse {
    text: String,
}

pub async fn transcribe(audio_data: Vec<u8>, api_key: String) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    
    let part = multipart::Part::bytes(audio_data)
        .file_name("audio.wav")
        .mime_str("audio/wav")?;
    
    let form = multipart::Form::new()
        .part("file", part)
        .text("model", "whisper-large-v3-turbo")
        .text("response_format", "json");
    
    let response = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await?;
    
    let result: GroqResponse = response.json().await?;
    Ok(result.text)
}
