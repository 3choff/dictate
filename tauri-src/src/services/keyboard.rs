use enigo::{Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

pub fn insert_text_via_clipboard(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Store original clipboard
    let original = clipboard_win::get_clipboard_string().unwrap_or_default();
    
    // Set new clipboard content
    clipboard_win::set_clipboard_string(text)?;
    
    // Small delay to ensure clipboard is set
    thread::sleep(Duration::from_millis(50));
    
    // Simulate Ctrl+V
    let mut enigo = Enigo::new(&Settings::default())?;
    enigo.key(Key::Control, enigo::Direction::Press)?;
    enigo.key(Key::Unicode('v'), enigo::Direction::Click)?;
    enigo.key(Key::Control, enigo::Direction::Release)?;
    
    // Restore original clipboard after a delay
    thread::sleep(Duration::from_millis(300));
    clipboard_win::set_clipboard_string(&original)?;
    
    Ok(())
}
