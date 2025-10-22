use enigo::{Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Sends a paste command (Cmd+V or Ctrl+V) using platform-specific virtual key codes.
/// This ensures the paste works regardless of keyboard layout (e.g., Russian, AZERTY, DVORAK).
fn send_paste() -> Result<(), String> {
    // Platform-specific key definitions
    #[cfg(target_os = "macos")]
    let (modifier_key, v_key_code) = (Key::Meta, Key::Other(9));
    #[cfg(target_os = "windows")]
    let (modifier_key, v_key_code) = (Key::Control, Key::Other(0x56)); // VK_V
    #[cfg(target_os = "linux")]
    let (modifier_key, v_key_code) = (Key::Control, Key::Unicode('v'));

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;

    // Press modifier + V
    enigo
        .key(modifier_key, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier key: {}", e))?;
    enigo
        .key(v_key_code, enigo::Direction::Click)
        .map_err(|e| format!("Failed to click V key: {}", e))?;

    thread::sleep(Duration::from_millis(100));

    enigo
        .key(modifier_key, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier key: {}", e))?;

    Ok(())
}

pub fn insert_text_via_clipboard(text: &str, app_handle: &AppHandle) -> Result<(), String> {
    let clipboard = app_handle.clipboard();

    // Get the current clipboard content
    let clipboard_content = clipboard.read_text().unwrap_or_default();
    
    // Check if text ends with a space (for segment spacing)
    let has_trailing_space = text.ends_with(' ');
    
    // Write text to clipboard (trim trailing space if present, we'll add it via keypress)
    let text_to_paste = if has_trailing_space {
        text.trim_end()
    } else {
        text
    };

    clipboard
        .write_text(text_to_paste)
        .map_err(|e| format!("Failed to write to clipboard: {}", e))?;

    // Small delay to ensure the clipboard content has been written
    thread::sleep(Duration::from_millis(50));

    send_paste()?;

    thread::sleep(Duration::from_millis(50));
    
    // If text had trailing space, type it explicitly to ensure it appears in all apps
    if has_trailing_space {
        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("Failed to initialize Enigo for space: {}", e))?;
        
        enigo
            .key(Key::Space, enigo::Direction::Click)
            .map_err(|e| format!("Failed to type space: {}", e))?;
    }

    // Restore the clipboard
    clipboard
        .write_text(&clipboard_content)
        .map_err(|e| format!("Failed to restore clipboard: {}", e))?;

    Ok(())
}

pub fn copy_selected_text(app_handle: &AppHandle) -> Result<String, String> {
    // Platform-specific key definitions for Ctrl+C / Cmd+C
    #[cfg(target_os = "macos")]
    let (modifier_key, c_key_code) = (Key::Meta, Key::Other(8)); // Cmd+C on macOS
    #[cfg(target_os = "windows")]
    let (modifier_key, c_key_code) = (Key::Control, Key::Other(0x43)); // VK_C
    #[cfg(target_os = "linux")]
    let (modifier_key, c_key_code) = (Key::Control, Key::Unicode('c'));

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;

    // Press modifier + C
    enigo
        .key(modifier_key, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier key: {}", e))?;
    enigo
        .key(c_key_code, enigo::Direction::Click)
        .map_err(|e| format!("Failed to click C key: {}", e))?;

    thread::sleep(Duration::from_millis(100));

    enigo
        .key(modifier_key, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier key: {}", e))?;

    // Wait for clipboard to be populated
    thread::sleep(Duration::from_millis(100));

    // Get clipboard content using Tauri plugin
    let clipboard = app_handle.clipboard();
    let text = clipboard
        .read_text()
        .map_err(|e| format!("Failed to read clipboard: {}", e))?;

    Ok(text)
}
