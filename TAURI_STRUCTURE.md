# Tauri Project Structure Guide

## Overview
This document explains the modular architecture of the Tauri implementation, designed to scale as features are added.

## Backend Structure (`tauri-src/src/`)

### 1. Commands Module (`commands/`)
Tauri command handlers organized by feature area.

**Current files:**
- `transcription.rs` - Audio transcription commands
- `text_injection.rs` - Text insertion commands  
- `window.rs` - Window management commands

**How to add a new command:**
```rust
// In commands/my_feature.rs
#[tauri::command]
pub async fn my_command(param: String) -> Result<String, String> {
    // Implementation
    Ok("result".to_string())
}

// In commands/mod.rs
pub mod my_feature;
pub use my_feature::*;

// In lib.rs
.invoke_handler(tauri::generate_handler![
    commands::my_feature::my_command,
])
```

### 2. Providers Module (`providers/`)
Transcription service implementations following a common pattern.

**Current:**
- `groq.rs` - Groq Whisper implementation

**To add a new provider:**
1. Create `providers/provider_name.rs`
2. Implement the transcription function:
```rust
pub async fn transcribe(audio_data: Vec<u8>, api_key: String) -> Result<String, Box<dyn std::error::Error>> {
    // Provider-specific implementation
}
```
3. Add to `providers/mod.rs`:
```rust
pub mod provider_name;
```

### 3. Services Module (`services/`)
Reusable business logic shared across commands.

**Current:**
- `keyboard.rs` - Text injection via clipboard

**Purpose:**
- Keep commands thin (just parameter validation)
- Centralize complex logic
- Enable easier testing

### 4. Models Module (Future)
Shared data structures for type safety.

**Planned:**
- `settings.rs` - App settings struct
- `transcription.rs` - Transcription result types
- `provider_config.rs` - Provider configuration

## Frontend Structure (`ui/`)

### 1. Window Folders (`main/`, `settings/`)
Each window gets its own folder with:
- `index.html` - Window markup
- `main.js` / `settings.js` - Window logic
- `styles.css` - Window-specific styles

**Benefits:**
- Clear separation of concerns
- Easy to add new windows
- No naming conflicts

### 2. Shared Module (`shared/`)
Code reused across multiple windows.

**Current files:**
- `api.js` - Tauri API wrappers
- `constants.js` - Shared constants

**Example usage:**
```javascript
import { TauriAPI } from '../shared/api.js';

const text = await TauriAPI.transcribeAudio(audioData, apiKey);
```

## Adding New Features

### Example: Adding Deepgram Provider

**Backend:**
1. Create `tauri-src/src/providers/deepgram.rs`:
```rust
pub async fn transcribe(audio_data: Vec<u8>, api_key: String) -> Result<String, Box<dyn std::error::Error>> {
    // Deepgram streaming implementation
}
```

2. Update `providers/mod.rs`:
```rust
pub mod deepgram;
```

3. Update command to support multiple providers:
```rust
#[tauri::command]
pub async fn transcribe_audio(
    audio_data: Vec<u8>, 
    api_key: String,
    provider: String
) -> Result<String, String> {
    match provider.as_str() {
        "groq" => providers::groq::transcribe(audio_data, api_key),
        "deepgram" => providers::deepgram::transcribe(audio_data, api_key),
        _ => Err("Unknown provider".to_string())
    }
    .await
    .map_err(|e| e.to_string())
}
```

**Frontend:**
Update `shared/constants.js` and use in UI.

### Example: Adding Settings Window

**Backend:**
1. Create `commands/settings.rs`:
```rust
#[tauri::command]
pub async fn get_settings() -> Result<Settings, String> { ... }

#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), String> { ... }
```

2. Create `models/settings.rs`:
```rust
#[derive(Serialize, Deserialize)]
pub struct Settings {
    pub provider: String,
    pub api_keys: HashMap<String, String>,
    // ...
}
```

**Frontend:**
1. Create `ui/settings/` folder with HTML/JS/CSS
2. Update `tauri.conf.json` to define settings window
3. Use `shared/api.js` for consistent API calls

## Best Practices

1. **Keep commands thin** - Move logic to services
2. **One provider per file** - Easy to maintain
3. **Shared UI code** - Avoid duplication
4. **Type safety** - Use Rust structs for data
5. **Consistent naming** - Follow existing patterns

## Migration Checklist

When porting features from Electron:

- [ ] Identify the feature category (command/provider/service)
- [ ] Create appropriate module file
- [ ] Implement Rust backend logic
- [ ] Add Tauri command if needed
- [ ] Update frontend to use new command
- [ ] Test thoroughly
- [ ] Update this documentation

## Current vs Future

**Current (POC):**
- ✅ Groq provider
- ✅ Clipboard injection
- ✅ Global shortcuts
- ✅ Main window

**Next Steps:**
1. Add remaining providers (Deepgram, Cartesia, etc.)
2. Implement settings window
3. Add voice commands
4. Add grammar correction
5. Implement compact mode
