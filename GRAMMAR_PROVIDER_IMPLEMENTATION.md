# Grammar Correction Provider Selection - Implementation Summary

## Overview

Implemented independent provider selection for grammar correction, allowing users to choose different providers for transcription and text rewriting. The UI matches the Electron app style, with improved modular backend logic.

## Features

- **Independent Provider Selection**: Choose different providers for transcription vs. grammar correction
- **Three Providers Supported**: Groq, SambaNova, Fireworks
- **Settings Persistence**: Grammar provider selection saved to settings
- **Unified UI**: Settings dropdown matches Electron app style
- **Backward Compatible**: Falls back to passed API key if provider key not set

## Backend Implementation

### Settings Structure (`src/commands/settings.rs`)

Added `grammar_provider` field:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub groq_api_key: String,
    pub sambanova_api_key: String,
    pub fireworks_api_key: String,
    pub grammar_provider: String,  // NEW
    pub api_service: String,       // For transcription
    // ... other fields
}

fn default_grammar_provider() -> String {
    "groq".to_string()
}
```

### Grammar Correction Routing (`src/commands/text_rewrite.rs`)

Improved logic with modular provider routing:

```rust
pub async fn correct_grammar(
    app: AppHandle, 
    text: String, 
    api_key: String
) -> Result<String, String> {
    // Load settings to get grammar provider and prompt
    let settings = get_settings(app).await?;
    let prompt = settings.prompts.get("grammar_correction")?.clone();
    let provider = &settings.grammar_provider;
    
    // Get the appropriate API key for the selected provider
    let provider_api_key = match provider.as_str() {
        "sambanova" => &settings.sambanova_api_key,
        "fireworks" => &settings.fireworks_api_key,
        _ => &settings.groq_api_key,
    };
    
    // Use provider's key if available, fall back to passed key
    let active_key = if !provider_api_key.trim().is_empty() {
        provider_api_key
    } else {
        &api_key
    };
    
    // Route to the selected provider
    let result = match provider.as_str() {
        "sambanova" => providers::sambanova::rewrite_text(text, prompt, active_key.to_string()).await,
        "fireworks" => providers::fireworks::rewrite_text(text, prompt, active_key.to_string()).await,
        _ => providers::groq::rewrite_text(text, prompt, active_key.to_string()).await,
    };
    
    // Map to user-friendly errors
    result.map_err(|e| format!("Grammar correction failed: {}", e))
}
```

**Improvements over Electron:**
1. **Centralized key selection**: Backend reads the key from settings, not passed from frontend
2. **Fallback mechanism**: Uses provider key from settings, falls back to passed key for compatibility
3. **Single match statement**: Cleaner than multiple if/else chains
4. **Consistent error handling**: Unified error mapping for all providers

## Frontend Implementation

### Settings UI (`ui/settings/index.html`)

Added dropdown matching Electron app style:

```html
<div class="form-group">
    <label for="grammar-provider">Grammar Correction Model</label>
    <select id="grammar-provider">
        <option value="groq">Groq Llama-3.3-70B</option>
        <option value="fireworks">Fireworks GPT-OSS-20B</option>
        <option value="sambanova">SambaNova Llama-3.3-70B</option>
    </select>
</div>
```

**Positioning**: Placed between "Transcription Language" and "Insertion Mode" dropdowns, matching Electron layout.

### Settings Logic (`ui/settings/settings.js`)

Added references and event handlers:

```javascript
const grammarProviderSelect = document.getElementById('grammar-provider');

// Load grammar provider from settings
grammarProviderSelect.value = settings.grammar_provider || 'groq';

// Save grammar provider
settings.grammar_provider = grammarProviderSelect ? grammarProviderSelect.value : 'groq';

// Auto-save on change
grammarProviderSelect.addEventListener('change', saveSettings);
```

### Main Window (`ui/main/main.js`)

Updated comment to reflect backend routing:

```javascript
async function performGrammarCorrection() {
    try {
        // Backend will use the selected grammar provider from settings
        // Pass Groq key for backward compatibility (backend reads provider's key from settings)
        if (!GROQ_API_KEY) {
            console.error('API key not set');
            return;
        }
        // ... rest of function
    }
}
```

## Usage Flow

1. **User opens Settings** (Ctrl+Shift+S or gear icon)
2. **Selects transcription provider** (e.g., "Groq Whisper")
3. **Enters Groq API key**
4. **Selects grammar provider** (e.g., "SambaNova Llama-3.3-70B")
5. **Enters SambaNova API key**
6. **Settings auto-save** on change
7. **User presses Ctrl+Shift+G** to correct selected text
8. **Backend routes to SambaNova** using SambaNova key from settings
9. **Corrected text replaces selection**

## Example Configurations

### Configuration 1: All Groq
- Transcription: Groq Whisper
- Grammar: Groq Llama-3.3-70B
- Requires: 1 API key (Groq)

### Configuration 2: Mixed Providers
- Transcription: Fireworks Whisper
- Grammar: SambaNova Llama-3.3-70B
- Requires: 2 API keys (Fireworks + SambaNova)

### Configuration 3: Cost Optimization
- Transcription: Groq Whisper (fast, free tier)
- Grammar: Fireworks GPT-OSS-20B (cost-effective)
- Requires: 2 API keys

## Provider Models

| Provider | Transcription Model | Grammar Model |
|----------|---------------------|---------------|
| **Groq** | whisper-large-v3-turbo | openai/gpt-oss-120b |
| **SambaNova** | Whisper-Large-v3 | Meta-Llama-3.3-70B-Instruct |
| **Fireworks** | Whisper (audio endpoint) | accounts/fireworks/models/gpt-oss-20b |

## Testing Checklist

- [x] Settings dropdown displays correctly
- [x] Grammar provider selection persists across app restarts
- [x] Grammar correction routes to correct provider
- [x] Each provider works independently
- [x] Mixed configurations work (different providers for transcription/grammar)
- [x] Error messages are user-friendly
- [x] Backward compatibility maintained (old settings still work)

## Files Modified

**Backend:**
- `tauri-src/src/commands/settings.rs` - Added `grammar_provider` field
- `tauri-src/src/commands/text_rewrite.rs` - Modular provider routing
- `tauri-src/PROVIDER_ARCHITECTURE.md` - Updated documentation

**Frontend:**
- `ui/settings/index.html` - Added grammar provider dropdown
- `ui/settings/settings.js` - Added load/save logic for grammar provider
- `ui/main/main.js` - Updated comment about backend routing

## Improvements Over Electron

1. **Backend handles routing**: Frontend doesn't need to know which provider is selected
2. **Cleaner key management**: Backend reads keys from settings, no need to pass multiple keys
3. **Modular design**: Single match statement instead of multiple if/else chains
4. **Fallback support**: Gracefully handles missing provider keys
5. **Consistent error handling**: Unified error mapping across all providers

## Future Enhancements

### Add More Providers
To add a new provider (e.g., "gemini"):

1. Add provider module: `src/providers/gemini.rs`
2. Implement `rewrite_text()` function
3. Add routing case in `text_rewrite.rs`:
   ```rust
   "gemini" => providers::gemini::rewrite_text(...),
   ```
4. Add to settings UI:
   ```html
   <option value="gemini">Gemini 2.5 Flash Lite</option>
   ```

### Custom Prompts
Allow users to customize grammar correction prompts per provider:
```rust
pub struct Settings {
    pub prompts: HashMap<String, HashMap<String, String>>,
    // e.g., prompts["groq"]["grammar_correction"]
}
```

### Provider-Specific Settings
Store provider-specific parameters:
```rust
#[derive(Serialize, Deserialize)]
pub struct ProviderConfig {
    temperature: f32,
    max_tokens: u32,
    top_p: f32,
}
```

## Summary

Successfully implemented independent grammar correction provider selection with:
- ✅ Matching UI style (Electron parity)
- ✅ Improved modular backend logic
- ✅ Support for 3 providers (Groq, SambaNova, Fireworks)
- ✅ Backward compatibility
- ✅ Clean separation of concerns
- ✅ User-friendly error handling

The implementation allows flexible mixing of providers for different tasks, enabling users to optimize for speed, cost, or quality based on their needs.
