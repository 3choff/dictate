use enigo::{Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

/// Inject text using simulated keyboard typing
/// This is faster and more reliable than clipboard for most use cases
pub fn inject_text_native(text: &str) -> Result<(), String> {
    // Small delay to ensure the target window is ready
    thread::sleep(Duration::from_millis(50));
    
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    
    // Type the text character by character with a small delay
    // This makes it visible but still feels snappy
    for ch in text.chars() {
        enigo.text(&ch.to_string()).map_err(|e| e.to_string())?;
        // 5ms delay between characters - visible but fast
        thread::sleep(Duration::from_micros(5000));
    }
    
    Ok(())
}

/// Inject text with a newline at the end
#[allow(dead_code)]
pub fn inject_text_with_enter(text: &str) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    
    enigo.text(text).map_err(|e| e.to_string())?;
    thread::sleep(Duration::from_millis(10));
    enigo.key(Key::Return, enigo::Direction::Click).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Simulate pressing Enter key
#[allow(dead_code)]
pub fn press_enter() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(Key::Return, enigo::Direction::Click).map_err(|e| e.to_string())?;
    Ok(())
}

/// Simulate pressing a specific key combination
#[allow(dead_code)]
pub fn press_key_combination(keys: Vec<Key>) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    
    // Press all keys down
    for key in &keys {
        enigo.key(*key, enigo::Direction::Press).map_err(|e| e.to_string())?;
    }
    
    thread::sleep(Duration::from_millis(10));
    
    // Release all keys in reverse order
    for key in keys.iter().rev() {
        enigo.key(*key, enigo::Direction::Release).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
