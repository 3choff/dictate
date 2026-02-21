use enigo::{Enigo, Key, Keyboard};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use crate::EnigoState;

/// Sends a paste command (Cmd+V or Ctrl+V) using platform-specific virtual key codes.
/// Uses the provided Enigo instance.
fn send_paste(enigo: &mut Enigo) -> Result<(), String> {
    // Platform-specific key definitions
    #[cfg(target_os = "macos")]
    let (modifier_key, v_key_code) = (Key::Meta, Key::Other(9));
    #[cfg(target_os = "windows")]
    let (modifier_key, v_key_code) = (Key::Control, Key::Other(0x56)); // VK_V
    #[cfg(target_os = "linux")]
    let (modifier_key, v_key_code) = (Key::Control, Key::Unicode('v'));

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

    // Use shared Enigo instance
    let state = app_handle.state::<EnigoState>();
    let mut enigo = state.0.lock().map_err(|e| format!("Failed to lock Enigo: {}", e))?;

    send_paste(&mut enigo)?;

    thread::sleep(Duration::from_millis(50));
    
    // If text had trailing space, type it explicitly to ensure it appears in all apps
    if has_trailing_space {
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

    let state = app_handle.state::<EnigoState>();
    let mut enigo = state.0.lock().map_err(|e| format!("Failed to lock Enigo: {}", e))?;

    // BACKUP: Read current clipboard content
    let clipboard = app_handle.clipboard();
    let backup_content = clipboard.read_text().unwrap_or_default();

    // EXECUTE: 
    // Clear clipboard first so we can detect if Ctrl+C actually fails/does nothing
    let _ = clipboard.write_text("");
    thread::sleep(Duration::from_millis(20));

    enigo
        .key(modifier_key, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier key: {}", e))?;
    enigo
        .key(c_key_code, enigo::Direction::Click)
        .map_err(|e| format!("Failed to click C key: {}", e))?;

    thread::sleep(Duration::from_millis(50));

    enigo
        .key(modifier_key, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier key: {}", e))?;

    // Wait for clipboard to be populated (Copy can be slow depending on app)
    thread::sleep(Duration::from_millis(150));

    // READ: Get the selected text
    let selected_text = clipboard
        .read_text()
        .unwrap_or_default();

    // RESTORE: Write back the original content
    clipboard
        .write_text(&backup_content)
        .map_err(|e| format!("Failed to restore clipboard: {}", e))?;

    Ok(selected_text)
}

/// Sentinel string used to detect whether text is selected.
/// If clipboard still contains this after Ctrl+C, nothing was selected.
const REWRITE_SENTINEL: &str = "__DICTATE_REWRITE_SENTINEL_7f3a9b__";

/// Copies selected text, or selects all and copies if nothing is selected.
/// Uses a sentinel string to reliably detect whether a selection existed.
pub fn copy_selected_or_all_text(app_handle: &AppHandle) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    let (modifier_key, c_key_code, a_key_code) = (Key::Meta, Key::Other(8), Key::Other(0));
    #[cfg(target_os = "windows")]
    let (modifier_key, c_key_code, a_key_code) = (Key::Control, Key::Other(0x43), Key::Other(0x41));
    #[cfg(target_os = "linux")]
    let (modifier_key, c_key_code, a_key_code) = (Key::Control, Key::Unicode('c'), Key::Unicode('a'));

    let state = app_handle.state::<EnigoState>();
    let mut enigo = state.0.lock().map_err(|e| format!("Failed to lock Enigo: {}", e))?;

    let clipboard = app_handle.clipboard();

    // BACKUP: Save current clipboard content
    let backup_content = clipboard.read_text().unwrap_or_default();

    // SENTINEL: Write unique marker to clipboard
    clipboard
        .write_text(REWRITE_SENTINEL)
        .map_err(|e| format!("Failed to write sentinel: {}", e))?;
    thread::sleep(Duration::from_millis(20));

    // COPY: Send Ctrl+C to copy any selected text
    enigo
        .key(modifier_key, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier key: {}", e))?;
    enigo
        .key(c_key_code, enigo::Direction::Click)
        .map_err(|e| format!("Failed to click C key: {}", e))?;
    thread::sleep(Duration::from_millis(50));
    enigo
        .key(modifier_key, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier key: {}", e))?;

    // Wait for clipboard to be populated
    thread::sleep(Duration::from_millis(150));

    // READ: Check what's in the clipboard
    let clipboard_content = clipboard.read_text().unwrap_or_default();

    let result_text = if clipboard_content == REWRITE_SENTINEL || clipboard_content.is_empty() {
        // Sentinel unchanged or clipboard empty (read failed) → nothing was selected → select all, then copy
        enigo
            .key(modifier_key, enigo::Direction::Press)
            .map_err(|e| format!("Failed to press modifier for select-all: {}", e))?;
        enigo
            .key(a_key_code, enigo::Direction::Click)
            .map_err(|e| format!("Failed to click A key: {}", e))?;
        thread::sleep(Duration::from_millis(50));
        enigo
            .key(modifier_key, enigo::Direction::Release)
            .map_err(|e| format!("Failed to release modifier after select-all: {}", e))?;

        // Wait for selection to take effect
        thread::sleep(Duration::from_millis(100));

        // Now copy the selected-all text
        enigo
            .key(modifier_key, enigo::Direction::Press)
            .map_err(|e| format!("Failed to press modifier for copy: {}", e))?;
        enigo
            .key(c_key_code, enigo::Direction::Click)
            .map_err(|e| format!("Failed to click C key: {}", e))?;
        thread::sleep(Duration::from_millis(50));
        enigo
            .key(modifier_key, enigo::Direction::Release)
            .map_err(|e| format!("Failed to release modifier after copy: {}", e))?;

        // Wait for clipboard to be populated
        thread::sleep(Duration::from_millis(150));

        clipboard.read_text().unwrap_or_default()
    } else {
        // Clipboard changed to something other than sentinel → text was selected → use it
        clipboard_content
    };

    // RESTORE: Write back the original clipboard content
    clipboard
        .write_text(&backup_content)
        .map_err(|e| format!("Failed to restore clipboard: {}", e))?;

    Ok(result_text)
}
