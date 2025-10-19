use crate::vad::VadSessionManager;
use tauri::State;

#[tauri::command]
pub async fn vad_create_session(
    session_id: String,
    threshold: Option<f32>,
    silence_duration_ms: Option<u64>,
    state: State<'_, VadSessionManager>,
) -> Result<(), String> {
    state
        .create_session(session_id, threshold, silence_duration_ms)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn vad_push_frame(
    session_id: String,
    audio_data: Vec<u8>,
    state: State<'_, VadSessionManager>,
) -> Result<(), String> {
    state.push_frame(session_id, audio_data).await
}

#[tauri::command]
pub async fn vad_stop_session(
    session_id: String,
    state: State<'_, VadSessionManager>,
) -> Result<Vec<u8>, String> {
    state.stop_session(session_id)
}

#[tauri::command]
pub async fn vad_destroy_session(
    session_id: String,
    state: State<'_, VadSessionManager>,
) -> Result<(), String> {
    state.destroy_session(session_id)
}
