use tauri::State;
use crate::services::vad_segmenter::SharedVadSegmenter;

/// Process audio frame with VAD and return segment if ready
/// frame_i16: 320 samples @ 16kHz (20ms)
/// Returns: (should_emit, segment_data_if_ready)
#[tauri::command]
pub async fn vad_process_frame(
    frame_i16: Vec<i16>,
    vad_state: State<'_, SharedVadSegmenter>,
) -> Result<(bool, Option<Vec<i16>>), String> {
    let mut segmenter = vad_state.inner().lock().map_err(|e| format!("Failed to lock VAD: {}", e))?;
    
    segmenter.process_frame(&frame_i16)
}

/// Mark that segment processing is complete
#[tauri::command]
pub async fn vad_mark_complete(
    vad_state: State<'_, SharedVadSegmenter>,
) -> Result<(), String> {
    let mut segmenter = vad_state.inner().lock().map_err(|e| format!("Failed to lock VAD: {}", e))?;
    segmenter.mark_processing_complete();
    Ok(())
}

/// Flush final segment when stopping recording
#[tauri::command]
pub async fn vad_flush(
    vad_state: State<'_, SharedVadSegmenter>,
) -> Result<Option<Vec<i16>>, String> {
    let mut segmenter = vad_state.inner().lock().map_err(|e| format!("Failed to lock VAD: {}", e))?;
    Ok(segmenter.flush())
}

/// Reset VAD state (e.g., when starting new recording session)
#[tauri::command]
pub async fn vad_reset(
    vad_state: State<'_, SharedVadSegmenter>,
) -> Result<(), String> {
    let mut segmenter = vad_state.inner().lock().map_err(|e| format!("Failed to lock VAD: {}", e))?;
    segmenter.reset();
    Ok(())
}
