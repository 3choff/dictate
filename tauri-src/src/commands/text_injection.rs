use crate::services::{keyboard, keyboard_inject};

#[tauri::command]
pub async fn insert_text(text: String, insertion_mode: String) -> Result<(), String> {
    match insertion_mode.as_str() {
        "typing" => {
            keyboard_inject::inject_text_native(&text)
                .map_err(|e| e.to_string())
        }
        "clipboard" | _ => {
            keyboard::insert_text_via_clipboard(&text)
                .map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
pub async fn copy_selected_text() -> Result<String, String> {
    keyboard::copy_selected_text()
        .map_err(|e| e.to_string())
}
