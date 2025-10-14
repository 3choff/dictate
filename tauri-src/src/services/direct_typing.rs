use enigo::{Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

/// Inject text using simulated keyboard typing
/// Uses system input methods when possible, otherwise simulates keystrokes
pub fn inject_text_native(text: &str) -> Result<(), String> {
    // Small delay to ensure the target window is ready
    thread::sleep(Duration::from_millis(50));
    
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;
    
    // Send the entire text in one call - faster and more reliable
    // Enigo will use system input methods when available
    enigo
        .text(text)
        .map_err(|e| format!("Failed to send text directly: {}", e))?;
    
    Ok(())
}

/// Inject text with a newline at the end
#[allow(dead_code)]
pub fn inject_text_with_enter(text: &str) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;
    
    enigo.text(text)
        .map_err(|e| format!("Failed to send text: {}", e))?;
    thread::sleep(Duration::from_millis(10));
    enigo.key(Key::Return, enigo::Direction::Click)
        .map_err(|e| format!("Failed to press Enter: {}", e))?;
    
    Ok(())
}

/// Simulate pressing Enter key
#[allow(dead_code)]
pub fn press_enter() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;
    enigo.key(Key::Return, enigo::Direction::Click)
        .map_err(|e| format!("Failed to press Enter: {}", e))?;
    Ok(())
}

/// Simulate pressing a specific key combination
#[allow(dead_code)]
pub fn press_key_combination(keys: Vec<Key>) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;
    
    // Press all keys down
    for key in &keys {
        enigo.key(*key, enigo::Direction::Press)
            .map_err(|e| format!("Failed to press key: {}", e))?;
    }
    
    thread::sleep(Duration::from_millis(10));
    
    // Release all keys in reverse order
    for key in keys.iter().rev() {
        enigo.key(*key, enigo::Direction::Release)
            .map_err(|e| format!("Failed to release key: {}", e))?;
    }
    
    Ok(())
}

/// Send a single key press (for voice commands)
pub fn send_key_native(key_name: &str) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;
    
    let key = match key_name.to_lowercase().as_str() {
        "enter" | "return" => Key::Return,
        "backspace" => Key::Backspace,
        "space" => Key::Space,
        "tab" => Key::Tab,
        "escape" | "esc" => Key::Escape,
        "delete" | "del" => Key::Delete,
        _ => return Err(format!("Unknown key: {}", key_name)),
    };
    
    enigo.key(key, enigo::Direction::Click)
        .map_err(|e| format!("Failed to press key: {}", e))?;
    Ok(())
}

/// Send a key combination (modifier + key) for voice commands
pub fn send_key_combo_native(modifier: &str, key_name: &str) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;
    
    // Map modifier string to Key
    let mod_key = match modifier.to_lowercase().as_str() {
        "control" | "ctrl" => Key::Control,
        "shift" => Key::Shift,
        "alt" => Key::Alt,
        "meta" | "cmd" | "command" => Key::Meta,
        _ => return Err(format!("Unknown modifier: {}", modifier)),
    };
    
    // Map key string to Key
    let key = match key_name.to_lowercase().as_str() {
        "a" => Key::Unicode('a'),
        "c" => Key::Unicode('c'),
        "v" => Key::Unicode('v'),
        "x" => Key::Unicode('x'),
        "z" => Key::Unicode('z'),
        "y" => Key::Unicode('y'),
        "s" => Key::Unicode('s'),
        "g" => Key::Unicode('g'),
        "backspace" => Key::Backspace,
        "delete" | "del" => Key::Delete,
        "enter" | "return" => Key::Return,
        _ => Key::Unicode(key_name.chars().next().unwrap_or('a')),
    };
    
    // Press modifier
    enigo.key(mod_key, enigo::Direction::Press)
        .map_err(|e| format!("Failed to press modifier key: {}", e))?;
    thread::sleep(Duration::from_millis(10));
    
    // Press key
    enigo.key(key, enigo::Direction::Click)
        .map_err(|e| format!("Failed to press key: {}", e))?;
    thread::sleep(Duration::from_millis(10));
    
    // Release modifier
    enigo.key(mod_key, enigo::Direction::Release)
        .map_err(|e| format!("Failed to release modifier key: {}", e))?;
    
    Ok(())
}
