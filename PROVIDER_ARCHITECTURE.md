# Provider Architecture

## Overview

Dictate supports multiple AI providers for Whisper-based audio transcription and LLM-based text transformation. All providers follow a consistent modular pattern for maintainability and extensibility.

## Current Providers

### Groq (`src/providers/groq.rs`)
- **Transcription Model**: `whisper-large-v3-turbo`
- **Rewrite Model**: `llama-3.3-70b-versatile`
- **API Base**: `https://api.groq.com/openai/v1/`

### SambaNova (`src/providers/sambanova.rs`)
- **Transcription Model**: `Whisper-Large-v3`
- **Rewrite Model**: `Meta-Llama-3.3-70B-Instruct`
- **API Base**: `https://api.sambanova.ai/v1/`

## Provider Interface

Each provider module implements two core functions:

### 1. Batch Audio Transcription
```rust
pub async fn transcribe_verbose(
    audio_data: Vec<u8>,
    api_key: String,
    language: Option<String>,
) -> Result<String, Box<dyn std::error::Error>>
```

**Purpose**: Transcribe audio segments using Whisper models
- Accepts WAV audio data as bytes
- Optional language parameter for better accuracy (None = auto-detect)
- Returns transcribed text or error

**Used by**: Real-time recording segmentation for dictation

### 2. Text Transformation
```rust
pub async fn rewrite_text(
    text: String,
    prompt: String,
    api_key: String,
) -> Result<String, Box<dyn std::error::Error>>
```

**Purpose**: Transform text using LLM chat completions
- Used for grammar correction, style changes, etc.
- Prompt defines the transformation (e.g., "Correct grammar and spelling...")
- Returns transformed text or error

**Used by**: Grammar correction feature (Ctrl+Shift+G)

## Shared Components

### HTTP Client
Each provider maintains a singleton HTTP client with:
- 30-second timeout
- Connection pooling (10 idle connections per host, 90s idle timeout)
- TCP keepalive (60s)
- HTTP/2 keepalive (30s interval, 20s timeout)

### Error Handling
Consistent error mapping:
- Timeout errors → "Request timeout"
- Connection errors → "Connection failed - check internet"
- HTTP errors → "API error (status): body"

### Request Structure

**Transcription (Multipart Form)**
```
POST /audio/transcriptions
Authorization: Bearer {api_key}
Accept: application/json

form-data:
  - file: {audio_bytes} (filename: audio.wav, mime: audio/wav)
  - model: {model_name}
  - response_format: json (Groq: verbose_json, SambaNova: json)
  - language: {code} (optional)
  - stream: false (SambaNova only)
```

**Rewrite (JSON Body)**
```
POST /chat/completions
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "model": "{model_name}",
  "messages": [
    {
      "role": "user",
      "content": "{prompt}\n\n{text}"
    }
  ],
  "stream": false,
  "temperature": 0.2,        // Groq only
  "top_p": 1.0,              // Groq only
  "max_completion_tokens": 1024  // Groq only
}
```

## Code Structure

Each provider file is organized as:

1. **HTTP Client Setup**
   - Static `HTTP_CLIENT` singleton
   - `get_http_client()` accessor

2. **Whisper Transcription Section**
   - Response structures
   - `transcribe_verbose()` function

3. **Chat Completion Section**
   - Request/response structures
   - `rewrite_text()` function

## Routing Logic

### Transcription Provider Routing

Provider selection for transcription is handled in `src/commands/transcription.rs`:

```rust
let service = api_service.unwrap_or_else(|| "groq".to_string());
match service.as_str() {
    "sambanova" => providers::sambanova::transcribe_verbose(...),
    "fireworks" => providers::fireworks::transcribe_verbose(...),
    _ => providers::groq::transcribe_verbose(...),  // Default: Groq
}
```

### Grammar Correction Provider Routing

Provider selection for grammar correction is handled in `src/commands/text_rewrite.rs`:

```rust
// Load grammar_provider from settings
let provider = &settings.grammar_provider;

// Get the appropriate API key for the selected provider
let provider_api_key = match provider.as_str() {
    "sambanova" => &settings.sambanova_api_key,
    "fireworks" => &settings.fireworks_api_key,
    _ => &settings.groq_api_key,  // Default: Groq
};

// Route to the selected provider
match provider.as_str() {
    "sambanova" => providers::sambanova::rewrite_text(...),
    "fireworks" => providers::fireworks::rewrite_text(...),
    _ => providers::groq::rewrite_text(...),
}
```

**Key Feature**: Grammar correction provider is independent of transcription provider. You can use Groq for transcription and SambaNova for grammar correction, or any combination.

## Adding New Providers

To add a new Whisper-based provider:

1. **Create provider module** (`src/providers/new_provider.rs`):
   - Copy structure from `groq.rs` or `sambanova.rs`
   - Implement `transcribe_verbose()` and `rewrite_text()`
   - Update HTTP client, endpoints, and models

2. **Register module** (`src/providers/mod.rs`):
   ```rust
   pub mod new_provider;
   ```

3. **Add routing** (`src/commands/transcription.rs`):
   ```rust
   match service.as_str() {
       "sambanova" => providers::sambanova::transcribe_verbose(...),
       "new_provider" => providers::new_provider::transcribe_verbose(...),
       _ => providers::groq::transcribe_verbose(...),
   }
   ```

4. **Update settings UI** (`ui/settings/index.html`):
   ```html
   <option value="new_provider">New Provider Whisper</option>
   ```

5. **Add settings field** (`tauri-src/src/commands/settings.rs`):
   ```rust
   pub new_provider_api_key: String,
   ```

## Future: Streaming Providers

For real-time streaming transcription (Deepgram, AssemblyAI, etc.):
- Create separate `streaming` submodule
- Implement WebSocket-based interfaces
- Add stream lifecycle management
- Update UI for streaming vs. batch modes

## Testing

Verify provider functionality:
1. Set API key in Settings
2. Select provider in dropdown
3. Test transcription with Ctrl+Shift+D
4. Test grammar correction with Ctrl+Shift+G
5. Check terminal logs for routing and errors

## Notes

- **Language codes**: ISO 639-1 (e.g., "en", "es", "it")
- **"multilingual"** or **empty** → auto-detect (None passed to provider)
- **Text formatting**: Controlled by `text_formatted` setting
  - `true`: Preserve capitalization and punctuation
  - `false`: Lowercase, remove punctuation
