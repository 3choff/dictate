## [1.9.0] - 2025-10-26

### 🎨 Major Feature: Complete Theme System Implementation

This release introduces a comprehensive dark/light theme system with centralized CSS variables, providing a polished and consistent user experience across all UI elements.

### Added
- **Complete Theme System**:
  - Dark and light theme modes with smooth transitions (0.3s ease)
  - Centralized theme variables in `ui/shared/theme.css` for all colors
  - System preference detection and manual override options
  - Theme toggle in settings under "Customize" section
  - Theme persistence across app restarts

- **Theme-Aware Components**:
  - Sparkle icon (dot and star) with theme-responsive colors
  - Audio visualizer bars with theme-appropriate colors for both inactive and active states
  - Tooltip styling (main window and settings window) with theme colors
  - All UI elements (buttons, borders, backgrounds) follow theme system
  - Loading states and hover effects respect theme colors

- **CSS Architecture Improvements**:
  - CSS variables for all theme-dependent properties
  - Consistent color naming convention (--primary-bg, --text-color, etc.)
  - Theme-aware visualizer colors that change during animation
  - Eliminated hardcoded colors throughout the codebase
  - Future-proof theming system for easy customization

### Technical
- **Theme Implementation**:
  - `theme.css` with comprehensive variable definitions for both themes
  - JavaScript theme switching with smooth transitions
  - Visualizer colors updated dynamically from CSS variables
  - Tooltip styling unified across main and settings windows
  - Help button functionality fixed in About section

- **Color System**:
  - Dark theme: Professional dark grays with blue accents
  - Light theme: Clean whites with blue accents for consistency
  - Visualizer: Theme-appropriate colors for both inactive and animated states
  - Smooth color transitions between themes

### Fixed
- **Help Button**: Fixed missing event listener in About section settings

---

## [1.8.0] - 2025-10-26

### 🎤 Major Feature: Push-to-Talk Mode

This release introduces a highly requested push-to-talk functionality for batch providers, enhanced UI with new icons, and better user feedback for missing API keys.

### Added
- **Push-to-Talk (PTT) Mode**:
  - Hold keyboard shortcut to record, release to stop and transcribe immediately
  - Available for batch providers: Groq, Gemini, Mistral, SambaNova, Fireworks
  - Toggle in settings under "Customize" section
  - Automatic warning when trying to enable PTT with streaming providers (Deepgram, Cartesia)
  - PTT disabled automatically when switching from batch to streaming provider
  - No VAD buffering delay - transcription starts immediately on key release
  
- **API Key Missing Notification**:
  - Tooltip notification appears when recording without configured API key
  - Provider-specific message: "No API key in settings"
  - Positioned intelligently (below mic button in normal mode, centered in compact mode)
  - Auto-dismisses after 2 seconds
  - Smooth fade-in/fade-out animation
  - Matches settings tooltip styling

- **New Visual Design**:
  - Updated microphone icon with filled ellipse for better visibility
  - Modern, cleaner recording button appearance
  - New application logo

### Changed
- **Settings UI Improvements**:
  - Push-to-Talk toggle with provider compatibility warnings
  - Warning message displays temporarily (6 seconds) when incompatible configuration selected
  - Dynamic provider change detection for PTT availability

### Technical
- **Backend Changes**:
  - Removed PTT support from streaming providers (Deepgram, Cartesia)
  - Cleaned up `start_streaming_transcription` command parameters
  - Simplified voice command execution for streaming providers

- **Frontend Changes**:
  - Added mode detection for tooltip positioning (normal vs compact view)
  - Enhanced SVG styling with separate CSS rules for `path` and `ellipse` elements
  - Tooltip CSS moved to stylesheet for consistency
  - Removed inline SVG styling for better maintainability

### Fixed
- Tooltip clipping issue in compact mode - now centered in window
- SVG fill color not applying to ellipse element

---

## [1.7.0] - 2025-10-24

### 🎨 Major Feature: Text Rewrite System

This release introduces a comprehensive text rewriting system with multiple modes and provider support, replacing the limited grammar correction feature with a powerful text transformation toolkit.

### Added
- **Text Rewrite Functionality**:
  - 5 rewrite modes: Grammar Correction, Professional Tone, Polite Tone, Casual Tone, Structured Reformulation
  - Multi-provider support: Groq (GPT-OSS-120B), Gemini (2.5 Flash Lite), Mistral (Small), SambaNova (Llama-3.3-70B), Fireworks (GPT-OSS-20B)
  - Customizable prompts stored in settings for each mode
  - Rewrite button (sparkle icon) in main window for quick access
  - Keyboard shortcut: Ctrl+Shift+R (customizable)
  - Voice command: "press rewrite" triggers rewrite on selected text
  
- **Settings UI Enhancements**:
  - New "Rewrite" settings tab with provider selection and mode dropdown
  - Dedicated API key fields for rewrite providers
  - Dynamic API key syncing between Transcription and Rewrite sections
  - Separate provider selection for transcription and rewriting

### Changed
- **Renamed from "Grammar Correction" to "Rewrite"**:
  - Command: `correct_grammar` → `rewrite_text`
  - CommandAction enum: `GrammarCorrect` → `Rewrite`
  - Keyboard shortcut field: `grammar_correction` → `rewrite`
  - Frontend variables: `grammarBtn` → `rewriteBtn`, `performGrammarCorrection()` → `performRewrite()`
  - Constants: `GRAMMAR_CORRECTION` → `REWRITE`
  - API key field IDs: `grammar*` → `rewrite*`

- **Voice Commands Cleanup**:
  - Removed obsolete "correct grammar" voice commands
  - Voice commands now defined entirely in Rust backend (`voice_commands.rs`)
  - Deleted unused frontend `voice-commands.js` file

### Improved
- **Provider Architecture**:
  - All 5 providers now support both transcription and text rewriting
  - Unified `rewrite_text()` function across all providers
  - Consistent error handling with user-friendly messages
  - Settings-based provider and mode selection

### Technical
- **Backend Changes**:
  - Updated `commands/text_rewrite.rs` with mode-based prompt selection
  - Enhanced all provider modules with `rewrite_text()` functions
  - Updated voice commands system to use `Rewrite` action
  - Settings structure expanded to support rewrite configuration

- **Frontend Changes**:
  - Modular settings sections for better organization
  - Auto-save functionality with 500ms debounce
  - API key field synchronization between sections
  - Removed unused shared utilities folder

- **Documentation**:
  - Updated `PROJECT_STRUCTURE.md` with complete rewrite system documentation
  - Added Text Rewrite Flow section
  - Documented all 5 rewrite modes with descriptions

### Removed
- `ui/shared/` folder (obsolete wrapper utilities)
  - `voice-commands.js` - Replaced by backend implementation
  - `constants.js` - Unused exports
  - `api.js` - Unused Tauri API wrappers

---

## [1.6.2] - 2025-10-22

### Added
- **Keyboard Shortcuts Customization**: Complete system for personalizing global keyboard shortcuts
  - New "Shortcuts" tab in settings window with dedicated section
  - 6 customizable shortcuts: Toggle Recording, Grammar Correction, Toggle View, Toggle Settings, Toggle Debug, Close App
  - Click input field and press desired key combination to set new shortcuts
  - Changes apply immediately without app restart
  - Restore to default button for each shortcut
  - Settings persist across app restarts

### Fixed
- **Trailing Space Issue**: Fixed missing spaces between transcribed segments in terminals and address bars
  - Command prompt (cmd), PowerShell, and browser address bars now properly display spaces
  - Clipboard paste method enhanced to explicitly type space after pasting if needed
  - Works for all transcription providers (batch and streaming)
  - Maintains existing behavior in text editors and word processors

### Technical Improvements
- **Backend**: Dynamic shortcut registration from saved settings
- **Frontend**: Auto-save mechanism with debounced updates
- **Cross-platform**: Space insertion works reliably across all applications

---

## [1.6.1] - 2025-10-21

### Added
- **Tooltip Component**: Created reusable tooltip system for better UX guidance
  - `ui/settings/components/tooltip.js` - Flexible tooltip component with position options (top, bottom, left, right)
  - Smart positioning with viewport boundary detection
  - Smooth fade-in/scale animation
  - Tooltips added to Customize section: Insertion Mode, Text formatted, Voice commands, and Audio feedback toggles
  - Dark theme styling matching app design

- **Audio Feedback Toggle**: New setting to control audio cues during recording
  - Toggle in Customize section to enable/disable beep and clack sounds
  - Setting persists across app restarts
  - Respects user preference for silent operation

### Fixed
- **Settings Auto-save**: Fixed dropdown changes not triggering auto-save
  - Custom select dropdowns now properly dispatch bubbling change events
  - All settings (dropdowns, toggles, text inputs) now auto-save on change
  - Eliminated need to close settings window to persist changes

- **Settings Load on Startup**: Fixed settings window showing default values instead of saved preferences
  - Corrected initialization order: settings now load before custom dropdowns render
  - All saved settings properly display when opening settings window

- **Cursor Behavior**: Removed unwanted text cursor in settings UI
  - Applied `cursor: default` globally to prevent text selection cursor on labels and headings
  - Text input fields retain proper text cursor
  - Consistent cursor behavior throughout settings interface

### Changed
- **Label Display**: Insertion Mode label now uses `display: inline-block` for proper tooltip centering
- **User Selection**: Disabled text selection on UI elements (labels, headings) for cleaner UX

---

## [1.6.0] - 2025-10-19

### 🎨 Major UI Refactor: Settings Window Reorganization

This release introduces a complete redesign of the settings interface, transitioning from a flat single-page layout to an organized tabbed section-based architecture with improved navigation and visual hierarchy.

### Added
- **Tabbed Section Navigation**:
  - Sidebar navigation with icon-based tabs for easy section switching
  - Four organized sections: General (Customize), Transcription, Grammar, and About
  - Visual active state indicator with accent color highlighting
  - Smooth transitions between sections
  
- **Modular Section Architecture**:
  - `sections/general.js` - Customize panel for text insertion, auto-record, and audio cues
  - `sections/transcription.js` - Transcription provider, language selection, and API keys
  - `sections/grammar.js` - Grammar correction provider and shared API key management
  - `sections/about.js` - Version info, update checker, and external links
  - Component-based field system (SelectField, PasswordField, ToggleField)

- **Enhanced About Section**:
  - Dedicated About tab with app version display
  - "Update Available" notice with direct link to GitHub releases
  - Quick access buttons: Help (Issues), GitHub (Source), Ko-fi (Donate)
  - External link handling via Tauri opener plugin

### Changed
- **Settings Architecture Refactor**:
  - Migrated from monolithic `settings.js` to modular section-based system
  - Created `SettingsManager` class to coordinate section rendering and state
  - Implemented section factory pattern for clean instantiation
  - Auto-save functionality preserved across all fields
  
- **UI Layout Improvements**:
  - Left sidebar (55px) for navigation icons with tooltips
  - Main content area with scrollable sections
  - Footer with version info and quick action buttons
  - Responsive design with proper overflow handling

### Fixed
- **Custom Dropdown Clipping**: 
  - Fixed dropdown menus being cut off by footer in settings window
  - Increased dropdown z-index from 2 to 1000 to render above all elements
  - Implemented smart positioning with fixed positioning strategy
  - Dropdowns automatically flip above trigger when insufficient space below
  - Dynamic scrolling for tall dropdown lists with height calculation

### Technical
- **File Structure**:
  - `settings.js` - Main settings manager and initialization
  - `sections/` - Individual section implementations
  - `fields/` - Reusable field components
  - Preserved backward compatibility with existing settings storage

---

## [1.5.0] - 2025-10-19

### 🎯 Major Feature: Silero VAD (Voice Activity Detection)

This release introduces ML-based Voice Activity Detection using the Silero VAD model, replacing the previous RMS (Root Mean Square) threshold approach. The new VAD system dramatically improves speech segmentation accuracy, eliminates false positives from background noise, and provides consistent performance across different microphones and environments.

### Added
- **Silero VAD Module (Rust)**:
  - `vad/silero.rs` - Silero VAD wrapper for ML-based speech detection (30ms frames @ 16kHz)
  - `vad/smoothed.rs` - SmoothedVad wrapper with onset detection (60ms), hangover (300ms), and prefill buffering (300ms)
  - `vad/session_manager.rs` - Thread-safe session manager with tokio async processing
  - `vad/mod.rs` - Public interface with VoiceActivityDetector trait and VadFrame enum
  - Model file: `resources/models/silero_vad_v4.onnx` (bundled with application)

- **VAD Commands (Tauri)**:
  - `vad_create_session` - Initialize VAD session with configurable threshold and silence duration
  - `vad_push_frame` - Send audio frames for processing (non-blocking async)
  - `vad_stop_session` - Stop session and retrieve final buffered audio
  - `vad_destroy_session` - Cleanup and remove session

- **Event System**:
  - `speech_segment_ready` event - Emitted from Rust to frontend when speech segment detected
  - Includes session ID, PCM16 audio data, and duration metadata

### Changed
- **BatchProvider Refactor**:
  - Replaced RMS-based segmentation (~90 lines) with VAD integration (~60 lines)
  - Removed manual silence detection, boundary tracking, and buffer management
  - Integrated event-driven segment reception from Rust VAD
  - All 5 batch providers (Groq, Gemini, Mistral, SambaNova, Fireworks) now use VAD automatically

- **Segmentation Parameters**:
  - Silence threshold: Reduced from 1500ms to 400ms for faster response
  - Hangover duration: Optimized from 450ms to 300ms for quicker segment cutoff
  - Onset frames: 2 frames (~60ms) to prevent false positives
  - Prefill buffer: 300ms to capture word beginnings
  - Max segment duration: 30 seconds (enforced)

---

## [1.4.0] - 2025-10-18

### 🎉 Major Architectural Refactor: Unified Audio Pipeline

This release represents a comprehensive architectural overhaul of the audio capture and transcription system, completed across 5 phases. The new architecture provides a cleaner, more maintainable codebase with unified audio processing across all providers.

### Added
- **Provider Abstraction Layer (Phase 1)**: 
  - Created `BaseProvider` interface with `BatchProvider` and streaming provider implementations
  - Factory pattern for provider instantiation (`createProvider()`)
  - All 7 providers now implement consistent interfaces: `start()`, `stop()`, `getName()`, `getType()`
  
- **Unified Audio Capture (Phase 2)**:
  - `AudioCaptureManager` class as single point of microphone access
  - Centralized AudioContext and AudioWorklet management
  - Eliminates audio stream duplication and contention issues
  - Shared audio pipeline for visualization and transcription
  
- **RecordingSession Manager (Phase 4)**:
  - Encapsulates provider, audio capture, and visualizer lifecycle
  - Single point of control for start/stop/cleanup operations
  - Improved error handling and resource management
  - Preserves mic warmup optimization for quick restarts

### Changed
- **Main.js Refactor (Phase 3)**:
  - Migrated from provider-specific logic to unified provider system
  - Simplified `startRecording()` and `stopRecording()` functions
  - Removed provider-specific conditional branches
  - Cleaner separation between UI and session management

- **Deepgram Simplification (Phase 5)**:
  - Removed MediaRecorder complexity (~60 lines of code eliminated)
  - Now uses PCM16 directly like Cartesia and batch providers
  - Unified audio pipeline: all 7 providers use same PCM16 format
  - Added `sample_rate=16000` parameter for Deepgram's linear16 encoding

### Improved
- **Laptop Microphone Compatibility**:
  - Enabled Auto Gain Control (AGC) for quieter laptop microphones
  - Lowered silence detection threshold from -30dB to -40dB
  - Visualizer sensitivity adjustments (threshold from 2 to 1.5)
  - Fixes issue where laptop mics were detected as silent

- **Speech-Optimized Audio Visualizer**:
  - Focused frequency range on speech-relevant 85 Hz - 4 kHz (was 0-9 kHz)
  - Applied perceptual weighting curve to balance all 9 bars
  - Progressive boost: [1.0, 1.1, 1.3, 1.6, 2.0, 2.5, 3.0, 3.5, 4.0]
  - Creates engaging, balanced visualization instead of flat right-side bars
  - Follows industry-standard approach used in professional audio software

### Technical
- **Provider Architecture**:
  - `BaseProvider` (base-provider.js): Common interface and configuration
  - `BatchProvider` (batch-provider.js): Segmentation logic for non-streaming
  - `DeepgramProvider`, `CartesiaProvider`: Streaming implementations
  - `GroqProvider`, `GeminiProvider`, `MistralProvider`, `SambaNovaProvider`, `FireworksProvider`: Batch implementations
  - `ProviderFactory` (provider-factory.js): Provider instantiation

- **Audio Architecture**:
  - `AudioCaptureManager` (audio-capture.js): Microphone and AudioContext management
  - `AudioVisualizer` (audio-visualizer.js): Real-time frequency visualization
  - `RecordingSession` (recording-session.js): Lifecycle orchestration
  - Unified PCM16 pipeline at 16kHz for all providers

- **Code Quality**:
  - Removed ~100+ lines of duplicate/legacy code
  - Eliminated provider-specific conditionals in main.js
  - Improved error handling across all providers
  - Added comprehensive logging for debugging

### Benefits
- **Maintainability**: Single codebase pattern for all providers
- **Reliability**: Unified audio pipeline eliminates format inconsistencies  
- **Performance**: Reduced complexity and memory overhead
- **Extensibility**: Adding new providers requires minimal code
- **UX**: Better laptop mic support and engaging visualizer

### Breaking Changes
- None - all existing functionality preserved

---

## [1.3.3] - 2025-10-18

### Improved
- **Settings Management**: Optimized settings loading to prevent unnecessary cascading reloads on startup
- **Audio Processing**: Migrated from deprecated ScriptProcessorNode to modern AudioWorkletNode for better performance
- **Event Emission**: Refined event system to only emit settings-changed events when user preferences change, not for internal updates like window position

### Technical
- **Selective Event Emission**: Window position and compact mode changes no longer trigger frontend reloads
- **AudioWorklet Implementation**: Created dedicated audio-processor.js worklet for audio capture and processing in separate thread
- **Loading Guards**: Added duplicate load prevention for both settings and AudioWorklet modules
- **Reduced Log Noise**: Removed verbose settings loading/saving logs while preserving error logging
- **Deepgram Session Management**: Improved session lifecycle with proper event handler cleanup and session ID validation

### Fixed
- **Startup Performance**: Reduced settings loads from 5+ to 2 on application startup
- **Browser Console Warnings**: Eliminated ScriptProcessorNode deprecation warnings
- **Deepgram Session Errors**: Fixed "Session not found" errors by preventing stale MediaRecorder callbacks from old sessions

## [1.3.2] - 2025-10-16

### Added
- **Audio Visualizer in Normal View**: Visualizer now appears in expanded mode when recording, positioned at bottom edge with upward-expanding bars

### Improved
- **Audio Visualizer Positioning**: Refined visualizer placement and bar expansion behavior across different view modes
- **Normal View Enhancement**: Visualizer now appears at bottom edge and bars expand upward when recording, hidden when idle
- **Compact View Behavior**: Maintained centered bar expansion for optimal inline layout
- **UI Polish**: Removed distracting pulse animation from microphone button for cleaner interface
- **Visual Consistency**: Improved alignment and spacing for better visual feedback

## [1.3.0] - 2025-10-16

### Added
- **Audio Visualizer**: Complete implementation with real-time animated bars that respond to microphone input across all transcription providers (Deepgram, Cartesia, Groq, OpenAI, etc.)
- **Unified Audio Architecture**: Centralized audio capture and visualization pipeline that eliminates stream contention and improves performance
- **Visual Bar Amplification**: Enhanced responsiveness with taller bars and better visual feedback for lower audio levels

### Improved
- **Stream Contention Fix**: Eliminated dual audio processing issues for Deepgram provider by cloning streams appropriately
- **Bar Reset Functionality**: Visualizer bars now properly reset to gray/4px state when recording stops
- **Compact View UI**: Enhanced compact mode visual appearance and transitions
- **Cross-Provider Visualizer**: Extended visualizer support to all batch providers (Groq, OpenAI, Sambanova, etc.) in addition to streaming providers

### Technical
- **Audio Processing Pipeline**: Restructured audio capture flow for better resource management and visualization accuracy
- **Error Handling**: Improved visualizer error handling and cleanup procedures
- **Performance**: Optimized audio processing to reduce latency and improve responsiveness

## [1.2.2] - 2025-10-14

### Improved
- **Cross-platform clipboard typing:** Replaced Windows-specific `clipboard-win` with `tauri_plugin_clipboard_manager` for better macOS/Linux compatibility
- **Virtual key code paste:** Updated paste commands to use platform-specific virtual key codes (VK_V on Windows, Key::Other(9) on macOS) for better keyboard layout compatibility
- **Direct typing improvements:** Enhanced direct typing method to use single-call text injection instead of per-character loops, improving speed and reliability
- **Better error handling:** Improved error messages throughout keyboard injection functions for easier debugging

## [1.2.0] - 2025-10-12

### Changed
- Modified settings window to remove shadow (`src-tauri/src/commands/settings.rs`).
- Updated SVG for settings button in `ui/main/index.html`.
- Updated SVG for help button in `ui/settings/index.html`.
- Added `overflow: hidden;` to `html, body` in `ui/main/styles.css` and `ui/settings/styles.css`.
- General settings UI and logic improvements (`ui/settings/settings.js`).

---

## [1.1.0] - 2025-10-12

### Added
- **Version in settings footer:** The app version is now displayed in the settings window (`ui/settings/index.html` via `#app-version`).
- **Update notification:** On load, the app checks the latest GitHub release tag and shows a clickable "New version available" notice (`#update-notice`) when a newer version exists.

### Changed
- **UI refinements:** Rounded corners with a frosted glass effect for both main and settings windows (`backdrop-filter: blur(10px)`), ensuring transparent borders and consistent clipping.

### Fixed
- **Grammar correction shortcut:** `Ctrl+Shift+G` now triggers grammar correction reliably by calling `performGrammarCorrection()` directly (no simulated click), avoiding unintended paste behavior.
- **Opener permissions:** Allowed opening the Releases URL via the Tauri opener capability.

---

## [1.0.0] - 2025-10-11

### 🎉 Major Release: Complete Migration to Tauri

This release marks the complete migration from Electron to Tauri, delivering a high-performance, resource-efficient desktop application built with Rust and modern web technologies.

### Added
- **Tauri-based architecture:** Complete rewrite using Tauri 2.x framework with Rust backend
- **Voice commands system:** Comprehensive voice command processing for all providers
  - Punctuation commands (period, comma, question mark, exclamation mark, etc.)
  - Key press commands (enter, tab, backspace, space, etc.)
  - Key combination commands (copy, paste, save, undo, select all, etc.)
  - Special commands (delete_last_word, grammar_correct, pause_dictation)
  - Regex-based command matching with flexible pattern recognition
  - Voice commands toggle in settings UI to enable/disable functionality
- **Rust-based transcription services:** All provider integrations rewritten in Rust
  - Groq (Whisper-Large-v3-Turbo) with silence-based chunking
  - Deepgram (Nova-3) real-time streaming transcription
  - Cartesia real-time streaming with PCM audio pipeline
  - Google Gemini (2.5 Flash Lite) non-streaming transcription
  - Mistral (Voxtral) audio transcription
  - SambaNova (Whisper-Large-v3) transcription
  - Fireworks Whisper transcription
- **Native keyboard injection:** Windows-native keyboard simulation using `enigo` crate
- **Streaming support:** Real-time transcription for Deepgram and Cartesia providers
- **Settings management:** Persistent settings with JSON storage
- **Global shortcuts:** Native global hotkey registration via Tauri plugins
- **Clipboard management:** Efficient clipboard operations via Tauri plugin
- **Grammar correction:** Multi-provider grammar correction support
  - Groq (GPT-OSS-120B)
  - Google Gemini (2.5 Flash Lite)
  - Mistral (Small)
  - SambaNova (Llama-3.3-70B)
  - Fireworks (GPT-OSS-20B)

### Changed
- **Performance improvements:** ~80% reduction in memory usage compared to Electron version
- **Faster startup:** Near-instant application launch with optimized Rust binary
- **Smaller binary size:** Significantly reduced distributable size with Tauri's compact runtime
- **Improved reliability:** Type-safe Rust backend eliminates entire classes of runtime errors
- **Modern build system:** Cargo-based build with optimized release profile (size and LTO optimizations)
- **Architecture redesign:**
  - Frontend: HTML/CSS/JavaScript for UI and audio capture
  - Backend: Rust for API calls, transcription processing, and system integration
  - IPC: Tauri command system for secure frontend-backend communication
- **Voice command consistency:** Commands now work identically across all providers (streaming and batch)

### Technical Details
- **Backend dependencies:**
  - `tauri 2.8.5` - Core framework
  - `tokio` - Async runtime for concurrent operations
  - `reqwest` - HTTP client with HTTP/2 and TLS support
  - `tokio-tungstenite` - WebSocket client for streaming providers
  - `enigo 0.2` - Native keyboard injection
  - `serde/serde_json` - Serialization/deserialization
  - `regex` - Voice command pattern matching
  - `base64`, `urlencoding` - Data encoding utilities
  - `chrono` - Timestamp handling
- **Build optimizations:**
  - Size optimization (`opt-level = "z"`)
  - Link-time optimization (LTO)
  - Symbol stripping
  - Single codegen unit for maximum optimization
- **Tauri plugins:**
  - `tauri-plugin-global-shortcut` - System-wide keyboard shortcuts
  - `tauri-plugin-clipboard-manager` - Clipboard operations
  - `tauri-plugin-opener` - URL/file opening

### Migration Notes
- The Electron-based version (v0.6.7) is preserved in the `electron/` directory as legacy code
- Settings from the Electron version are not automatically migrated
- All functionality from the Electron version is replicated or improved in the Tauri version
- Build process changed from `npm run build` to `npm run tauri build`
- Development mode changed from `npm start` to `npm run tauri dev`

### Breaking Changes
- Requires Rust toolchain for building from source
- Settings storage location changed (no automatic migration)
- Different build commands and directory structure

---

## Electron Legacy Versions (0.x.x)

The following versions represent the legacy Electron-based implementation, available in the `electron/` directory.

## [0.6.7] - 2025-10-04

### Changed
- Optimized build configuration to include only required dependencies, reducing bundle size and improving startup performance.
- Enabled ASAR packaging for faster file I/O and compressed app code.

### Removed
- Unused dependencies (`express`, `multer`) that were inflating the build size.

## [0.6.6] - 2025-10-04

### Added
- Global shortcut `Ctrl+Shift+V` toggles between compact and expanded window layouts.
- Compact mode preference is now persisted and restored on launch, so the window reopens in the last chosen view.

## [0.6.5] - 2025-09-28

### Added
- Automated version sync (`npm run sync-doc-version`) now reads the latest entry in `CHANGELOG.md` and updates both `package.json` and `README.md` to match.

### Changed
- Settings label now calls the non-clipboard mode "Simulated Typing (SendKeys)" to clarify the behavior.

### Fixed
- Taskbar icon is hidden immediately when the window closes, eliminating orphaned entries.
- Window position persistence now saves during movement only, improving shutdown responsiveness.

## [0.6.4] - 2025-09-28

### Added

### Changed
- Main window launches at the default size but restores your last on-screen position to stay out of the way between sessions.

### Fixed
- Voice command rearraged and removed duplicated commands.

## [0.6.3] - 2025-09-28

### Added
- Deepgram streaming now always loads the provider bundle (`src/shared/providers/deepgram.js`) and forwards the selected language or `multi` plus `endpointing=100` for reliable multilingual transcripts.

### Changed
- Main window is created with `focusable: false`, so clicking Dictate no longer steals focus from the target application while issuing commands.

### Fixed
- Non-ASCII characters are now handled correctly in native injection using the clipboard fallback.

## [0.6.2] - 2025-09-27

### Added
- Smooth compact/expanded window transitions and state animations in `src/renderer/main/styles.css` for a more polished layout switch.
- Optional system tray support (currently commented) that can be re-enabled via `setupTray()` to provide quick access without the main window.

### Changed
- Main window now uses the bundled `assets/icon/icon.ico`, so the Windows taskbar shows the Dictate glyph instead of the default Electron icon.
- Default window styling keeps the dark theme consistent during mode switches by harmonizing body padding and background settings.

## [0.6.1] - 2025-09-27

### Changed
- Windows now wait for their renderers to finish loading before displaying, eliminating the white flash on the main and settings windows.
- Electron windows explicitly use the app's dark theme background color to prevent flicker during startup.

## [0.6.0] - 2025-09-27

### Added
- Real-time Cartesia streaming provider with manual PCM audio pipeline and settings UI selection.

### Changed
- Extracted `settings.js` and `index.js` to remove inline scripts from renderer HTML files, improving maintainability.
- Settings provider API key inputs are now generated dynamically from a single configuration.

### Fixed
- Voice commands (pause dictation, grammar correction, etc.) now also work for streaming providers by routing transcripts through `processAndInject()`.

## [0.5.1] - 2025-09-27

### Added
- Persist main window position and size across launches, restoring to the last location within the active display work area.

### Changed
- Cleanup timer-based saving of main window bounds when the window moves or resizes to reduce disk writes.

### Fixed
- Prevent main window from reopening off-screen by clamping saved bounds to the current monitor.

## [0.5.0] - 2025-09-27

### Added
- Voice command phrases for "select all" (Ctrl+A), grammar correction macro, and pausing dictation (Ctrl+Shift+D).

### Changed
- Voice commands can now be toggled via settings and the parser respects the toggle in both injection flows.
- Grammar correction voice commands trigger select-all before running the shortcut to ensure the provider works on the current text.

### Fixed
- "Delete that" voice command removes the last spoken word reliably and no longer reinserts the command text.

## [0.4.1] - 2025-09-27

### Changed
- Settings window now positions itself relative to available screen space (prefers left, then right, below, above) instead of always shifting left.

## [0.4.0] - 2025-09-26

### Added
- Transcription language selector in the settings window with support for multilingual fallback.

### Changed
- Migrated all provider integrations into `src/shared/providers/` and updated imports across the app.
- Updated Gemini transcription and rewrite endpoints to `gemini-flash-lite-latest`.
- Mistral, SambaNova, Fireworks, and Deepgram providers now consume the saved transcription language when available.

### Fixed
- SambaNova Whisper requests now retry with the correct model casing to avoid `Model not found` responses.

## [0.3.4] - 2025-09-25

### Added
- New provider: SambaNova Whisper-Large-v3 for transcription and Llama-3.3-70B for rewrite actions.
- New provider: Fireworks Whisper transcription and GPT-OSS-20B rewrite helper.
- Mistral now exposes a text rewrite helper alongside transcription support.
- Settings UI now supports SambaNova and Fireworks API keys for both transcription and grammar rewrite providers.

### Changed
- Grammar rewrite prompts are now managed in `src/main/main.js`, making provider helpers prompt-agnostic.
- README updated to reflect SambaNova support across transcription and grammar correction providers.
- Settings grammar provider dropdown includes Groq, Gemini, Mistral, SambaNova, and Fireworks.
- Settings UI refinements: toggle switch for "Text formatted", updated labels/icons.

### Fixed
- N/A

## [0.3.3] - 2025-09-23

### Added
- Global shortcut: Ctrl+Shift+G to trigger Grammar Correction (sparkle) on the current selection.

### Changed
- Recording shortcut changed to Ctrl+Shift+D.
- Debug/DevTools toggle moved to Ctrl+Shift+L.
- README updated to reflect new shortcuts and version bumped to 0.3.3.

### Fixed
- N/A

## [0.3.2] - 2025-09-23

### Added
- Grammar correction action with abort-on-reclick (pulsing UI) for selected text.
- Groq-based grammar correction via Chat Completions (model: openai/gpt-oss-120b).
- Settings: new Grammar correction provider dropdown (Groq or Gemini).

### Changed
- Default grammar correction provider is now Groq; dropdown lists Groq first.
- README updated to document grammar correction and defaults; version bumped to 0.3.2.

### Fixed
- Minor UI polish for sparkle button active/idle states.

## [0.3.1] - 2025-09-23

### Added
- New provider: Mistral (non‑streaming) via the Audio Transcriptions API (multipart/form-data).
- Settings UI: Added Mistral to provider dropdown and a Mistral API Key field.

### Changed
- Main process now routes non‑streaming segments to Groq, Gemini, or Mistral based on selected provider, reusing the same formatting and command parsing path.

### Fixed
- N/A

## [0.3.0] - 2025-09-23

### Added
- New provider: Google Gemini Flash (non‑streaming) with inline audio transcription via the Generative Language API.
- Settings UI: Added Gemini to provider dropdown and a Gemini API Key field.

### Changed
- Main process now routes non‑streaming segments to Groq or Gemini based on selected provider, reusing formatting and unified command parsing.
- The existing "Text formatted" setting applies to Gemini as well (preserve vs. normalize in-app).

### Fixed
- N/A

## [0.2.2] - 2025-09-23

### Added
- Unified command parsing for Groq and Deepgram via a reusable `processAndInject()` in `src/main/main.js` that uses `src/shared/voice-commands.js` as the single source of truth.

### Changed
- Settings: single "Text formatted" option now controls both providers:
  - Groq: when unchecked, we normalize text (lowercase + remove punctuation); when checked, preserve as returned.
  - Deepgram: sets `smart_format` to match the setting (true when checked, false when unchecked).
- Settings UI: label text updated to "Text formatted".

### Fixed
- N/A

## [0.2.1] - 2025-09-23

### Added
- Settings: "Preserve original formatting (Groq only)" checkbox. When disabled, Groq transcriptions are lowercased and punctuation is removed before insertion.

### Changed
- None.

### Fixed
- None.

## [0.2.0] - 2025-09-23

### Added
- Groq (Whisper) silence-based chunking in the renderer:
  - Continuous capture with simple RMS level detector.
  - Segments are emitted on ~1s silence and sent as WAV to Groq.
  - Safety cut for long utterances and a minimal segment filter.
- Debug toggle via `Ctrl+Shift+D`:
  - Opens/closes DevTools and toggles verbose logs in both renderer and main.

### Changed
- Tuned thresholds to improve reliability across environments.
- Improved audio cue loading with base64/file URL fallback and preloading.

### Fixed
- Ensured audio processing node is connected so frames are processed in Groq mode.
- Added detailed logs to diagnose networking/API issues with Groq.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning (SemVer): MAJOR.MINOR.PATCH

## [0.1.0] - 2025-09-23

### Added
- Settings: Insertion Mode dropdown to choose between Clipboard (paste) and Native (SendKeys).
- Settings: Provider-specific API keys with eye-toggle inside the input to show/hide the key.
- Deepgram: Streaming transcription path with nova-3 defaults and configurable encoding based on MediaRecorder support.
- Voice Commands: Centralized `src/shared/voice-commands.js` with punctuation and key commands, plus "delete that" to remove last word.
- Packaging: Fallback loading for audio cues (beep/clack) via base64 or file URL.
- Asset discovery in packaged apps checks both `resources/assets/...` (extraResources) and `resources/app/assets/...` (bundled) paths.

### Changed
- Centralized Deepgram WebSocket URL builder and defaults in `src/shared/deepgram.js`.
- `insert-text` handler: parses and executes commands, inserts remaining text using the chosen insertion mode, and ensures trailing space between segments.
- Settings UI shows only the API key field relevant to the selected provider for a cleaner UI.

### Fixed
- Missing spaces between Deepgram segments while retaining command handling.
- Audio cue reliability after packaging by adding base64/file URL fallback and robust asset path resolution.
- Windows icon path for electron-builder (uses `assets/icon/`), avoiding default icon.
