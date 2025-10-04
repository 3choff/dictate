use crate::services::keyboard;

#[tauri::command]
pub async fn insert_text(text: String) -> Result<(), String> {
    keyboard::insert_text_via_clipboard(&text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn copy_selected_text() -> Result<String, String> {
    keyboard::copy_selected_text()
        .map_err(|e| e.to_string())
}
