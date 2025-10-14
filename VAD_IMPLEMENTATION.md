# WebRTC VAD Implementation

## Overview
Replaced the RMS/dB-based silence detection with WebRTC Voice Activity Detection (VAD) for more accurate speech/non-speech classification in batch transcription mode.

## Architecture

### Backend (Rust)
- **Crate**: `webrtc-vad 0.4`
- **Location**: `tauri-src/src/services/vad_segmenter.rs`
- **Mode**: Quality mode (best accuracy)
- **Sample rate**: 16 kHz
- **Frame size**: 20ms (320 samples)

### Key Components

#### 1. VadSegmenter Service
```rust
// tauri-src/src/services/vad_segmenter.rs
```
- Processes 20ms audio frames at 16kHz
- Tracks trailing non-speech duration
- Emits segments when:
  - 1 second (1000ms) of non-speech is detected, OR
  - Maximum segment duration (15 seconds) is reached
- Maintains minimum segment duration (200ms) to filter noise

#### 2. Tauri Commands
```rust
// tauri-src/src/commands/vad.rs
```
- `vad_process_frame`: Process a 20ms frame and return segment if ready
- `vad_mark_complete`: Mark that segment processing is complete (allows VAD to continue)
- `vad_flush`: Flush final segment when stopping recording
- `vad_reset`: Reset VAD state for new recording session

#### 3. Frontend Integration
```javascript
// ui/main/main.js
```
- Captures audio from microphone
- Downsamples to 16kHz
- Splits into 20ms frames (320 samples)
- Sends frames to backend VAD via `vad_process_frame`
- When segment is ready, sends to transcription API
- Marks VAD as complete after transcription

## User Experience

### Recording Flow
1. **Start Recording**: User clicks mic button
   - VAD state is reset
   - Audio capture begins
   - Frames are sent to VAD for analysis

2. **During Recording**: User speaks
   - VAD continuously analyzes speech vs non-speech
   - Audio is buffered in the backend
   - When user stops speaking for 1 second:
     - Segment is closed and returned to frontend
     - Frontend sends segment to transcription API
     - Transcribed text is inserted
     - VAD continues listening for next segment

3. **Stop Recording**: User clicks mic button again
   - Any remaining audio is flushed as final segment
   - Audio capture stops
   - Microphone is released

### Chunking Behavior
- **Same as before**: Chunks are sent when user stops speaking for 1 second
- **Difference**: Uses VAD to detect speech instead of RMS/dB threshold
- **Benefits**:
  - More accurate in noisy environments
  - Better handling of different speech patterns
  - Reduced false triggers from background noise

## Configuration

### VAD Parameters (in vad_segmenter.rs)
```rust
trailing_silence_threshold_ms: 1000,  // 1 second of non-speech ends chunk
min_segment_duration_ms: 200,         // Ignore blips shorter than 200ms
max_segment_duration_ms: 15000,       // Force boundary at 15 seconds
```

### VAD Mode
- **Current**: `VadMode::Quality`
- **Options**:
  - `VadMode::Quality` - Best accuracy (current)
  - `VadMode::LowBitrate` - Optimized for low bitrate
  - `VadMode::Aggressive` - More aggressive filtering
  - `VadMode::VeryAggressive` - Most aggressive filtering

## Advantages Over RMS-Based Detection

1. **Better accuracy**: VAD uses signal processing optimized for speech detection
2. **Noise robust**: More reliable in noisy environments
3. **Consistent**: Less dependent on microphone gain and audio levels
4. **Proven**: WebRTC VAD is battle-tested in production systems

## Compatibility

- Works with all **non-streaming** providers:
  - Groq Whisper
  - SambaNova Whisper
  - Fireworks Whisper
  - Google Gemini
  - Mistral Voxtral

- **Streaming providers** (Deepgram, Cartesia) use their own endpointing and are not affected by this change

## Testing

1. Start the app in dev mode: `npm run tauri dev`
2. Select a non-streaming provider (e.g., Groq)
3. Click record and speak
4. Pause for 1 second - should trigger segment boundary
5. Continue speaking - new segment should start
6. Verify transcriptions appear correctly
7. Stop recording - final segment should be processed

## Performance

- **CPU**: Minimal overhead (WebRTC VAD is very efficient)
- **Memory**: Small footprint (~few KB for VAD state)
- **Latency**: 20ms per frame processing (negligible)

## Future Improvements

1. Make VAD parameters configurable in settings
2. Add visual indicator of VAD speech/non-speech state
3. Experiment with different VAD modes for specific environments
4. Consider pre-roll buffer to avoid clipping initial consonants
