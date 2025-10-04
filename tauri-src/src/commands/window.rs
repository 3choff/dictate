use tauri::AppHandle;

#[tauri::command]
pub async fn prevent_focus(_app: AppHandle) -> Result<(), String> {
    // Focus prevention is handled by "focus": false in tauri.conf.json
    // This command is kept for compatibility but does nothing
    Ok(())
}
