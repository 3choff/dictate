# Audio Architecture Analysis & Improvement Plan

## Current Architecture Overview

### High-Level Audio Flow

```
User Click → UI → Audio Capture → Processing → Backend → Transcription → Text Insertion
                      ↓                             ↓
                 Visualization              Audio Analysis
```

## Detailed Current Implementation

### 1. Recording Initiation (Frontend)

**Entry Point:** `micButton.addEventListener('pointerdown')` → `startRecording()`

**Provider Detection:**
```javascript
const isStreaming = STREAMING_PROVIDERS.includes(API_SERVICE);
// ['deepgram', 'cartesia'] = streaming
// ['groq', 'sambanova', 'fireworks', 'gemini', 'mistral'] = batch
```

**Branch Logic:**
- If `isStreaming` → `startStreamingRecording()`
- Else → `startBatchRecording()`

---

### 2. Batch Recording Path (Groq, Gemini, Mistral, SambaNova, Fireworks)

#### Frontend Audio Capture
```
startBatchRecording()
  → Create AudioContext (segmentAudioCtx)
  → Load AudioWorklet module (audio-processor.js)
  → Create AudioWorkletNode (segmentProcessor)
  → Start visualizer: invoke('start_visualizer')
```

#### Audio Processing Loop (Frontend)
```
AudioWorkletNode.onmessage (every ~85ms)
  → Receive Float32 audio buffer
  → Calculate RMS & dB for silence detection
  → Downsample to 16kHz Int16
  → Accumulate samples (segmentSamples16k array)
  → Send to visualizer: invoke('send_visualization_audio')
  → Check silence thresholds
  → If silence detected OR max duration:
      → emitSegmentIfReady()
```

#### Segment Emission (Frontend)
```
emitSegmentIfReady()
  → Extract segment samples
  → Encode as WAV (encodeWav16kMono)
  → invoke('transcribe_audio_segment', {
      audioData: WAV bytes,
      apiService: provider name
    })
```

#### Backend Transcription
```
transcribe_audio_segment (commands/transcription.rs)
  → Route to provider module:
      - groq::transcribe()
      - gemini::transcribe()
      - etc.
  → Provider makes HTTP POST request
  → Returns transcript string
  → Process voice commands (if enabled)
  → Insert text via keyboard/clipboard service
```

#### Backend Visualization
```
send_visualization_audio (commands/streaming.rs)
  → Convert Int16 PCM → Float32 samples
  → VisualizerManager.send_audio_chunk()
  → AudioAnalyzer.feed() (FFT + frequency analysis)
  → Emit 'audio-bars-update' event to frontend
  → Frontend updates DOM bar heights
```

---

### 3. Streaming Recording Path (Deepgram, Cartesia)

#### Frontend Audio Capture
```
startStreamingRecording()
  → Create AudioContext (unifiedAudioCtx)
  → Load AudioWorklet module (audio-processor.js)
  → Create AudioWorkletNode (unifiedProcessor)
  → For Deepgram: Also create MediaRecorder (for Opus encoding)
  → Start backend session: invoke('start_streaming_transcription')
  → Returns sessionId
```

#### Audio Processing Loop (Frontend)

**Unified Path (Both Providers):**
```
AudioWorkletNode.onmessage (every ~85ms)
  → Receive Float32 audio buffer
  → Apply AGC spike mitigation
  → Downsample to 16kHz Int16
  → Send to visualizer: invoke('send_visualization_audio')
```

**Provider-Specific:**

**Deepgram:**
```
MediaRecorder.ondataavailable (every 250ms)
  → Blob contains Opus-encoded audio
  → Convert to Uint8Array
  → invoke('send_streaming_audio', { sessionId, audioData })
```

**Cartesia:**
```
AudioWorkletNode.onmessage
  → Use same PCM16 data from downsampling
  → invoke('send_streaming_audio', { sessionId, audioData })
```

#### Backend Streaming Session
```
start_streaming_transcription (commands/streaming.rs)
  → Create WebSocket connection to provider
  → Spawn tokio task to handle WS messages
  → Store session in StreamingState
  → Start VisualizerManager
  → Return sessionId
```

#### Backend Audio Streaming
```
send_streaming_audio (commands/streaming.rs)
  → Look up session by sessionId
  → Send audio chunk through channel (mpsc)
  → Background task forwards to WebSocket
  → WebSocket receives transcript
  → Process voice commands (if enabled)
  → Insert text via keyboard/clipboard service
```

---

## Current Visualization Architecture

### Frontend (UI Layer)
```javascript
// HTML: 9 bar divs in audioVisualizer
<div class="audio-visualizer">
  <div class="bar"></div> × 9
</div>

// JavaScript: Listens for backend events
listen('audio-bars-update', (event) => {
  updateBarHeights(event.payload.bars); // Directly manipulates DOM
});
```

### Backend (Processing Layer)
```rust
// visualizer_manager.rs
VisualizerManager
  → Receives PCM16 audio chunks
  → Converts to Float32
  → Spawns background tokio task
  → AudioAnalyzer.feed() - FFT processing
  → Emits 'audio-bars-update' event

// audio_analyzer.rs
AudioAnalyzer
  → Accumulates samples in buffer
  → Performs FFT (Fast Fourier Transform)
  → Splits frequencies into 9 buckets
  → Returns amplitude array [f32; 9]
```

---

## Identified Issues & Improvement Opportunities

### 1. **Duplicate Audio Capture Logic**

**Problem:**
- Batch mode uses `segmentAudioCtx` + `segmentProcessor`
- Streaming mode uses `unifiedAudioCtx` + `unifiedProcessor`
- Both do identical operations:
  - Create AudioContext
  - Load AudioWorklet module
  - Create AudioWorkletNode
  - Downsample to 16kHz
  - Send to visualizer

**Impact:**
- ~150 lines of duplicated code
- Higher maintenance burden
- Inconsistent behavior risk

---

### 2. **Fragmented Visualization Pipeline**

**Problem:**
- Batch: Sends audio via `send_visualization_audio` in segment loop
- Streaming (Deepgram): Sends audio via `send_visualization_audio` in unified loop
- Streaming (Cartesia): Sends audio via `send_visualization_audio` in unified loop
- All three paths ultimately call the same backend function

**Impact:**
- Multiple code paths for same functionality
- Difficult to modify visualization behavior

---

### 3. **Deepgram Dual-Stream Complexity**

**Problem:**
- Deepgram uses **two** separate audio streams:
  1. AudioWorkletNode → PCM16 → Visualization
  2. MediaRecorder → Opus → Transcription
- Requires stream cloning (`micStream.clone()`)
- More complex lifecycle management

**Why:**
- Deepgram WebSocket requires Opus/WebM encoding
- AudioWorklet provides raw PCM for visualization

**Impact:**
- Special-case code for Deepgram
- Potential audio sync issues
- Complex cleanup logic

---

### 4. **Backend Handling of UI Concerns**

**Problem:**
- Backend performs FFT analysis (`AudioAnalyzer`)
- Backend determines bar heights
- Backend emits UI events (`audio-bars-update`)
- Frontend is just a "dumb" renderer

**Current Split:**
```
Backend:                 Frontend:
- Receives PCM audio     - Listens for events
- FFT processing         - Updates DOM
- Frequency buckets      
- Amplitude calculation
- Event emission
```

**Concerns:**
- Heavy backend involvement in UI concerns
- Tight coupling between audio processing and visualization
- Cannot easily change visualization without Rust changes

---

### 5. **Provider-Specific Branching in Multiple Locations**

**Problem:**
```javascript
// Frontend has provider checks in:
- startRecording() (streaming vs batch)
- startStreamingRecording() (deepgram vs cartesia)
- stopRecording() (different cleanup paths)
- Audio worklet message handlers (different processing)
```

**Impact:**
- Scattered conditional logic
- Harder to add new providers
- Difficult to trace execution flow

---

### 6. **Inconsistent Session Management**

**Batch Mode:**
- No session concept
- Each segment is independent
- Visualizer started once per recording

**Streaming Mode:**
- Session-based (sessionId)
- Persistent WebSocket connection
- Visualizer tied to session lifecycle

**Impact:**
- Different mental models
- Complex cleanup logic
- Harder to implement features that work across both modes

---

### 7. **Audio Format Conversions Scattered Across Codebase**

**Problem:**
```
Frontend:                Backend:
- Float32 from worklet   - Vec<u8> PCM bytes
- Downsample to 16kHz    - Convert to Vec<f32>
- Convert to Int16       - Normalize to -1.0..1.0
- Convert to WAV bytes   - FFT processing
```

**Impact:**
- Multiple conversion steps
- Performance overhead
- Potential precision loss

---

## Improvement Proposals

### Proposal 1: Unified Audio Capture Module

**Goal:** Single audio capture path for all providers

**Design:**
```javascript
// New unified module: audio-capture.js

class AudioCaptureManager {
  constructor(micStream, provider) {
    this.micStream = micStream;
    this.provider = provider;
    this.audioContext = null;
    this.workletNode = null;
  }

  async start() {
    // Common initialization
    this.audioContext = new AudioContext();
    await this.audioContext.audioWorklet.addModule('./audio-processor.js');
    
    // Create source
    const source = this.audioContext.createMediaStreamSource(this.micStream);
    
    // Create worklet
    this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');
    
    // Set up unified message handler
    this.workletNode.port.onmessage = (event) => {
      this.handleAudioData(event.data);
    };
    
    // Connect
    source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  handleAudioData({ audioData, sampleRate }) {
    // Common processing
    const int16 = downsampleTo16kInt16(audioData, sampleRate);
    
    // Always visualize
    this.sendToVisualizer(int16);
    
    // Provider-specific routing
    this.routeToProvider(int16);
  }

  routeToProvider(int16) {
    if (this.provider.isStreaming) {
      this.provider.sendAudioChunk(int16);
    } else {
      this.provider.accumulateSegment(int16);
    }
  }

  async stop() {
    // Common cleanup
  }
}
```

**Benefits:**
- Single audio capture path
- Eliminates ~100 lines of duplication
- Easier to maintain and test
- Clear separation of concerns

---

### Proposal 2: Provider Abstraction Layer

**Goal:** Unified provider interface

**Design:**
```javascript
// New file: providers/base-provider.js

class TranscriptionProvider {
  constructor(config) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.isStreaming = config.isStreaming;
  }

  // Must be implemented by subclasses
  async initialize() {}
  async sendAudioChunk(pcm16Data) {}
  async finalize() {}
  async cleanup() {}
}

// providers/deepgram-provider.js
class DeepgramProvider extends TranscriptionProvider {
  constructor(config) {
    super({ ...config, isStreaming: true });
    this.mediaRecorder = null;
    this.sessionId = null;
  }

  async initialize() {
    this.sessionId = await invoke('start_streaming_transcription', {
      provider: 'deepgram',
      // ...
    });
    
    // Set up MediaRecorder for Opus encoding
    this.mediaRecorder = new MediaRecorder(micStream, { 
      mimeType: 'audio/webm;codecs=opus' 
    });
    
    this.mediaRecorder.ondataavailable = async (event) => {
      const audioData = await event.data.arrayBuffer();
      await invoke('send_streaming_audio', {
        sessionId: this.sessionId,
        audioData: Array.from(new Uint8Array(audioData))
      });
    };
    
    this.mediaRecorder.start(250);
  }

  sendAudioChunk(pcm16Data) {
    // Deepgram uses MediaRecorder, so this is a no-op
    // Audio is sent via MediaRecorder.ondataavailable
  }

  async cleanup() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
    
    await invoke('stop_streaming_transcription', { 
      sessionId: this.sessionId 
    });
  }
}

// providers/groq-provider.js
class GroqProvider extends TranscriptionProvider {
  constructor(config) {
    super({ ...config, isStreaming: false });
    this.accumulatedSamples = [];
    this.lastBoundary = 0;
    this.silenceMs = 0;
  }

  async initialize() {
    await invoke('start_visualizer', { 
      sessionId: `batch_${Date.now()}` 
    });
  }

  sendAudioChunk(pcm16Data) {
    // Accumulate samples
    this.accumulatedSamples.push(...pcm16Data);
    
    // Check silence/duration thresholds
    if (this.shouldEmitSegment()) {
      this.emitSegment();
    }
  }

  async emitSegment() {
    const wavBytes = encodeWav16kMono(Int16Array.from(this.accumulatedSamples));
    
    await invoke('transcribe_audio_segment', {
      audioData: Array.from(wavBytes),
      apiService: 'groq',
      // ...
    });
    
    this.accumulatedSamples = [];
  }

  async finalize() {
    // Emit final segment
    if (this.accumulatedSamples.length > 0) {
      await this.emitSegment();
    }
  }

  async cleanup() {
    await invoke('stop_visualizer');
  }
}
```

**Benefits:**
- Clear provider interface
- No branching in main recording logic
- Easy to add new providers
- Provider-specific logic encapsulated

---

### Proposal 3: Move Visualization to Frontend

**Goal:** Separate audio processing from UI rendering

**Current (Backend-Heavy):**
```
Frontend:               Backend:
- Send PCM bytes →      - Convert to Float32
                        - FFT analysis
                        - Frequency bucketing
                        - Amplitude calculation
← Receive bar heights   - Emit UI event
- Update DOM
```

**Proposed (Frontend-Heavy):**
```
Frontend:               Backend:
- Receive PCM bytes     - Transcription only
- FFT analysis (Web Audio API)
- Frequency bucketing
- Amplitude calculation
- Update DOM
```

**Implementation:**
```javascript
// New file: audio-visualizer.js

class AudioVisualizer {
  constructor(audioContext, barElements) {
    this.audioContext = audioContext;
    this.barElements = barElements;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;
    
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.animationId = null;
  }

  connect(sourceNode) {
    sourceNode.connect(this.analyser);
  }

  start() {
    this.updateBars();
  }

  updateBars() {
    this.animationId = requestAnimationFrame(() => this.updateBars());
    
    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Split into 9 buckets (same as backend logic)
    const buckets = this.splitIntoBuckets(this.dataArray);
    
    // Update DOM
    this.barElements.forEach((bar, i) => {
      const height = Math.max(4, buckets[i] * 40); // Scale to pixels
      bar.style.height = `${height}px`;
    });
  }

  splitIntoBuckets(freqData) {
    // Same bucketing logic as backend AudioAnalyzer
    const buckets = new Array(9).fill(0);
    const bucketSize = Math.floor(freqData.length / 9);
    
    for (let i = 0; i < 9; i++) {
      const start = i * bucketSize;
      const end = start + bucketSize;
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += freqData[j];
      }
      buckets[i] = sum / bucketSize / 255; // Normalize
    }
    
    return buckets;
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Reset bars
    this.barElements.forEach(bar => {
      bar.style.height = '4px';
    });
  }
}
```

**Benefits:**
- No backend involvement in UI
- Uses native Web Audio API (AnalyserNode)
- Eliminates backend → frontend event emission
- Better performance (no IPC overhead)
- Easier to customize visualization
- Can run at 60fps via requestAnimationFrame

**Tradeoffs:**
- Slightly more frontend code
- Different API than backend implementation
- Need to ensure FFT settings match (for consistency)

---

### Proposal 4: Unified Session Model

**Goal:** Use session concept for both streaming and batch

**Design:**
```javascript
// Unified session manager

class RecordingSession {
  constructor(provider, audioCaptureManager) {
    this.sessionId = `${provider.name}_${Date.now()}`;
    this.provider = provider;
    this.audioCaptureManager = audioCaptureManager;
    this.visualizer = null;
  }

  async start() {
    // Initialize provider (WebSocket or prepare for batch)
    await this.provider.initialize(this.sessionId);
    
    // Start audio capture
    await this.audioCaptureManager.start((audioData) => {
      this.provider.sendAudioChunk(audioData);
    });
    
    // Start visualizer
    this.visualizer = new AudioVisualizer(
      this.audioCaptureManager.audioContext,
      document.querySelectorAll('.bar')
    );
    this.visualizer.connect(this.audioCaptureManager.sourceNode);
    this.visualizer.start();
  }

  async stop() {
    // Stop visualizer
    this.visualizer?.stop();
    
    // Finalize provider (send last segment or close WebSocket)
    await this.provider.finalize();
    
    // Stop audio capture
    await this.audioCaptureManager.stop();
    
    // Cleanup
    await this.provider.cleanup();
  }
}
```

**Benefits:**
- Consistent lifecycle management
- Clear start/stop flow
- Easier error handling
- Unified cleanup logic

---

### Proposal 5: Eliminate Unnecessary Backend Visualization State

**Current Issues:**
- VisualizerManager maintains state (is_active, channels)
- AudioAnalyzer maintains buffer
- Backend emits events to frontend
- Adds complexity and overhead

**Proposed:**
- Remove `visualizer_manager.rs`
- Remove `audio_analyzer.rs`
- Remove `send_visualization_audio` command
- Remove `start_visualizer` / `stop_visualizer` commands
- Frontend handles all visualization

**Benefits:**
- Simpler backend
- Faster visualization (no IPC)
- Better separation of concerns
- Less state to manage

---

## Implementation Plan

### Phase 1: Refactor Visualization to Frontend (Quickest Win)

**Duration:** 1-2 hours

**Tasks:**
1. Create `audio-visualizer.js` using Web Audio API AnalyserNode
2. Update `main.js` to instantiate AudioVisualizer
3. Connect visualizer to audio source in both batch and streaming paths
4. Remove backend visualization code:
   - Delete `visualizer_manager.rs`
   - Delete `audio_analyzer.rs`
   - Remove `send_visualization_audio` command
   - Remove `start_visualizer` / `stop_visualizer` commands
5. Test with all providers

**Validation:**
- Visualizer works in both batch and streaming modes
- Performance is equal or better
- No console errors

---

### Phase 2: Create Unified Audio Capture Module

**Duration:** 2-3 hours

**Tasks:**
1. Create `audio-capture-manager.js`:
   - Consolidate AudioContext creation
   - Consolidate AudioWorklet setup
   - Unified audio data handling
2. Refactor `startBatchRecording()` to use new manager
3. Refactor `startStreamingRecording()` to use new manager
4. Remove old `segmentAudioCtx` / `unifiedAudioCtx` code
5. Test with all providers

**Validation:**
- All providers work correctly
- No functional regressions
- Code is ~100 lines shorter

---

### Phase 3: Implement Provider Abstraction Layer

**Duration:** 3-4 hours

**Tasks:**
1. Create `providers/base-provider.js` with interface
2. Create provider implementations:
   - `deepgram-provider.js`
   - `cartesia-provider.js`
   - `groq-provider.js`
   - `gemini-provider.js`
   - `mistral-provider.js`
   - `sambanova-provider.js`
   - `fireworks-provider.js`
3. Create provider factory:
   ```javascript
   function createProvider(apiService, config) {
     switch(apiService) {
       case 'deepgram': return new DeepgramProvider(config);
       case 'cartesia': return new CartesiaProvider(config);
       // ...
     }
   }
   ```
4. Refactor `startRecording()` to use providers
5. Remove old branching logic
6. Test each provider

**Validation:**
- All providers work correctly
- Branching logic is eliminated from main code
- Adding new provider only requires new provider file

---

### Phase 4: Implement Unified Session Model

**Duration:** 2-3 hours

**Tasks:**
1. Create `recording-session.js`:
   - Unified start/stop lifecycle
   - Integrates AudioCaptureManager and Provider
2. Update `startRecording()` / `stopRecording()`:
   ```javascript
   let currentSession = null;

   async function startRecording() {
     const provider = createProvider(API_SERVICE, { apiKey, language, ... });
     const audioCapture = new AudioCaptureManager(micStream);
     
     currentSession = new RecordingSession(provider, audioCapture);
     await currentSession.start();
   }

   async function stopRecording() {
     await currentSession?.stop();
     currentSession = null;
   }
   ```
3. Test lifecycle with all providers

**Validation:**
- Clean start/stop flow
- No memory leaks
- Error handling works correctly

---

### Phase 5: Optimize Deepgram Dual-Stream (Optional)

**Duration:** 2-3 hours

**Goal:** Investigate if Deepgram can accept PCM16 instead of Opus

**Tasks:**
1. Research Deepgram API documentation for PCM support
2. If supported:
   - Modify DeepgramProvider to send PCM16
   - Remove MediaRecorder setup
   - Remove stream cloning
   - Use unified audio path
3. Test transcription quality and latency

**Benefits (if feasible):**
- Simpler Deepgram implementation
- No special-case code
- Better audio sync

---

## Expected Outcomes

### Code Metrics
- **Lines of Code:** -300 to -400 lines
- **Complexity:** Reduced cyclomatic complexity by ~40%
- **Files:** +7 new (provider files), -2 backend (visualizer/analyzer)

### Maintainability
- **Provider Addition:** From ~50 lines scattered across files → Single provider file
- **Bug Fixes:** Easier to trace issues (clearer separation)
- **Testing:** Can unit test providers independently

### Performance
- **Visualization:** Frontend-only = 60fps (vs backend IPC = ~40fps)
- **Startup:** No backend visualizer initialization
- **Memory:** Less state in backend

### Architecture
- **Clear Separation:** Frontend = UI + providers, Backend = transcription
- **Modularity:** Providers are plug-and-play
- **Extensibility:** Easy to add new providers or visualization styles

---

## Rollback Strategy

Each phase is independent and can be rolled back:

**Phase 1 (Visualization):**
- Revert to backend visualization
- Re-add deleted files

**Phase 2 (Audio Capture):**
- Keep old batch/streaming paths
- Remove AudioCaptureManager

**Phase 3 (Provider Abstraction):**
- Keep provider branching in main code
- Remove provider files

**Phase 4 (Session Model):**
- Keep direct provider calls
- Remove RecordingSession

---

## Risk Assessment

### Low Risk
- Phase 1 (Visualization): Web Audio API is well-supported
- Phase 2 (Audio Capture): Consolidation of identical code

### Medium Risk
- Phase 3 (Provider Abstraction): Large refactor, need thorough testing
- Phase 4 (Session Model): Changes main recording flow

### High Risk
- Phase 5 (Deepgram Optimization): May not be feasible, depends on API support

---

## Conclusion

The current architecture works but has accumulated technical debt:
- Duplicate audio capture logic
- Backend handling UI concerns
- Scattered provider-specific branching
- Complex visualization pipeline

The proposed improvements will:
- ✅ Reduce code by ~300 lines
- ✅ Improve maintainability
- ✅ Better separation of concerns
- ✅ Easier to add new providers
- ✅ Better performance for visualization

**Recommended Approach:**
Start with Phase 1 (visualization) as a quick win, then proceed through phases 2-4. Phase 5 is optional and should be investigated separately.
