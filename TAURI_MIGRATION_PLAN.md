# Tauri Migration Plan - Complete Electron to Tauri Migration

## Overview
This document outlines the complete migration plan from Electron to Tauri, maintaining 100% feature parity and UI consistency.

---

## Current Status (POC Complete ✅)

### Implemented Features
- ✅ Basic audio recording
- ✅ Groq Whisper transcription
- ✅ Clipboard-based text insertion
- ✅ Settings window with API key storage
- ✅ Global shortcuts (Ctrl+Shift+D, Ctrl+Shift+L, Ctrl+Shift+V, Ctrl+Shift+G)
- ✅ Modular architecture (commands, providers, services)
- ✅ DevTools access
- ✅ Compact mode with right-click toggle
- ✅ Grammar correction (Ctrl+Shift+G)
- ✅ Window management and DPI scaling



---

## Migration Stages

### **Stage 1: Core Transcription Providers** 🎯 PRIORITY
**Goal**: Add all remaining transcription providers

#### Tasks:
1. **Deepgram Provider** (Streaming)
   - [ ] Create `providers/deepgram.rs`
   - [ ] Implement WebSocket streaming
   - [ ] Add to settings UI (API key field)
   - [ ] Test streaming transcription

2. **Cartesia Provider** (Streaming)
   - [ ] Create `providers/cartesia.rs`
   - [ ] Implement streaming logic
   - [ ] Add to settings UI
   - [ ] Test real-time transcription

3. **Gemini Provider**
   - [ ] Create `providers/gemini.rs`
   - [ ] Implement Gemini API integration
   - [ ] Add to settings UI
   - [ ] Test transcription

4. **Mistral Provider**
   - [ ] Create `providers/mistral.rs`
   - [ ] Implement API integration
   - [ ] Add to settings UI
   - [ ] Test transcription

5. **SambaNova Provider**
   - [ ] Create `providers/sambanova.rs`
   - [ ] Implement API integration
   - [ ] Add to settings UI
   - [ ] Test transcription

6. **Fireworks Provider**
   - [ ] Create `providers/fireworks.rs`
   - [ ] Implement API integration
   - [ ] Add to settings UI
   - [ ] Test transcription

**Estimated Time**: 2-3 weeks
**Dependencies**: None
**Testing**: Each provider should transcribe a test audio file successfully

---

### **Stage 2: Enhanced Settings Window**
**Goal**: Match Electron settings functionality

#### Tasks:
1. **Provider Selection**
   - [ ] Add dropdown to select active provider
   - [ ] Store selected provider in settings
   - [ ] Update transcription command to use selected provider

2. **API Keys Management**
   - [ ] Add fields for all provider API keys
   - [ ] Organize by tabs or sections
   - [ ] Add validation for each key format

3. **Insertion Mode Settings**
   - [ ] Add toggle: Clipboard vs Native (SendKeys)
   - [ ] Implement native keyboard injection (robotjs equivalent)
   - [ ] Create `services/native_keyboard.rs` using Windows API

4. **Language Selection**
   - [ ] Add language dropdown
   - [ ] Pass language to providers
   - [ ] Support multi-language mode

5. **UI Enhancements**
   - [ ] Add tabs for organization (General, Providers, Advanced)
   - [ ] Add "Test" buttons for each provider
   - [ ] Show connection status indicators

**Estimated Time**: 1-2 weeks
**Dependencies**: Stage 1 (providers)
**Testing**: All settings should persist and apply correctly

---

### **Stage 3: Voice Commands System**
**Goal**: Port voice command processing from Electron

#### Tasks:
1. **Voice Commands Service**
   - [ ] Create `services/voice_commands.rs`
   - [ ] Port command patterns from `src/shared/voice-commands.js`
   - [ ] Implement command matching logic
   - [ ] Add command execution handlers

2. **Command Types**
   - [ ] **Navigation**: "new line", "new paragraph", "go back"
   - [ ] **Editing**: "delete that", "undo that", "select all"
   - [ ] **Formatting**: "capitalize", "uppercase", "lowercase"
   - [ ] **Punctuation**: "period", "comma", "question mark"
   - [ ] **Custom**: User-defined commands

3. **Settings Integration**
   - [ ] Add voice commands enable/disable toggle
   - [ ] Add custom commands editor
   - [ ] Store commands in settings

4. **Testing**
   - [ ] Test each command category
   - [ ] Verify command priority/precedence
   - [ ] Test custom commands

**Estimated Time**: 2 weeks
**Dependencies**: Stage 1 (transcription working)
**Testing**: All voice commands should execute correctly

---

### **Stage 4: Grammar Correction (Gemini)** ✅ COMPLETED
**Goal**: Port grammar correction feature

#### Tasks:
1. **Grammar Service**
   - [x] Integrated with existing providers
   - [x] Implemented text correction logic
   - [x] Added text selection handling
   - [x] Implemented correction replacement logic

2. **Global Shortcut**
   - [x] Added Ctrl+Shift+G shortcut
   - [x] Trigger correction on selected text
   - [x] Integrated with UI feedback

3. **UI Feedback**
   - [ ] Add sparkle animation (optional)
   - [ ] Show correction status
   - [ ] Handle errors gracefully

4. **Settings**
   - [ ] Add Gemini API key field
   - [ ] Add enable/disable toggle
   - [ ] Add custom prompt configuration

**Estimated Time**: 1 week
**Dependencies**: Stage 1 (Gemini provider)
**Testing**: Correct selected text with various inputs

---

### **Stage 5: Compact Mode & View Toggle** ✅ COMPLETED
**Goal**: Implement compact view with persistence

#### Tasks:
1. **Compact Mode UI**
   - [x] Create compact CSS styles
   - [x] Add transition animations
   - [x] Match Electron compact design exactly

2. **Toggle Functionality**
   - [x] Implement Ctrl+Shift+V shortcut
   - [x] Add right-click toggle
   - [x] Smooth transition between modes

3. **Persistence**
   - [x] Store compact mode state in settings
   - [x] Restore on app launch
   - [x] Adjust window size accordingly

4. **Window Management**
   - [x] Update window handling in `commands/settings.rs`
   - [x] Handle window resizing with DPI scaling
   - [x] Maintain position during toggle

**Estimated Time**: 3-4 days
**Dependencies**: None
**Testing**: Toggle should work smoothly, state should persist

---

### **Stage 6: UI Polish & Exact Electron Match**
**Goal**: Achieve pixel-perfect UI match with Electron version

#### Tasks:
1. **Main Window**
   - [ ] Match exact colors, fonts, sizes
   - [ ] Copy animations from Electron
   - [ ] Add all visual states (recording, processing, error)
   - [ ] Add audio feedback (beep.mp3, clack.mp3)

2. **Settings Window**
   - [ ] Match Electron settings layout
   - [ ] Copy all styling details
   - [ ] Add same validation messages
   - [ ] Match button styles and positions

3. **Animations**
   - [ ] Recording pulse animation
   - [ ] Compact mode transition
   - [ ] Sparkle effect (grammar correction)
   - [ ] Loading indicators

4. **Icons & Assets**
   - [ ] Use same icon files
   - [ ] Copy all SVG assets
   - [ ] Match icon sizes and colors

**Estimated Time**: 1 week
**Dependencies**: All previous stages
**Testing**: Side-by-side comparison with Electron version

---

### **Stage 7: Advanced Features**
**Goal**: Add remaining Electron features

#### Tasks:
1. **Window Position Persistence**
   - [ ] Save window position on move
   - [ ] Restore position on launch
   - [ ] Handle multi-monitor setups

2. **Tray Icon** (Optional)
   - [ ] Add system tray icon
   - [ ] Add tray menu
   - [ ] Show/hide from tray

3. **Auto-Updater**
   - [ ] Integrate Tauri updater
   - [ ] Add update check on launch
   - [ ] Show update notification

4. **Crash Reporting** (Optional)
   - [ ] Add error logging
   - [ ] Implement crash handler
   - [ ] Send reports to server

5. **Keyboard Shortcuts Manager**
   - [ ] Allow custom shortcut configuration
   - [ ] Validate shortcut conflicts
   - [ ] Store in settings

**Estimated Time**: 1-2 weeks
**Dependencies**: All previous stages
**Testing**: Each feature should work reliably

---

### **Stage 8: Bug Fixes & Optimization**
**Goal**: Resolve known issues and optimize performance

#### Tasks:
1. **Critical Bugs**
   - [ ] **Fix window focus issue** when clicking mic button
   - [ ] Fix right-click context menu (if still broken)
   - [ ] Fix any provider-specific issues

2. **Performance Optimization**
   - [ ] Optimize audio processing
   - [ ] Reduce memory usage
   - [ ] Improve startup time
   - [ ] Lazy-load providers

3. **Error Handling**
   - [ ] Add comprehensive error messages
   - [ ] Handle network failures gracefully
   - [ ] Add retry logic for API calls
   - [ ] Validate all user inputs

4. **Testing**
   - [ ] Write unit tests for Rust code
   - [ ] Add integration tests
   - [ ] Test on different Windows versions
   - [ ] Test with various audio devices

**Estimated Time**: 1-2 weeks
**Dependencies**: All previous stages
**Testing**: Full regression testing

---

### **Stage 9: Documentation & Release**
**Goal**: Prepare for production release

#### Tasks:
1. **Documentation**
   - [ ] Update README with Tauri instructions
   - [ ] Create user guide
   - [ ] Document all keyboard shortcuts
   - [ ] Add troubleshooting section

2. **Build & Package**
   - [ ] Create MSI installer
   - [ ] Add code signing certificate
   - [ ] Test installer on clean Windows
   - [ ] Create portable version

3. **Release Preparation**
   - [ ] Create GitHub release
   - [ ] Write release notes
   - [ ] Update version numbers
   - [ ] Tag release in git

4. **Migration Guide**
   - [ ] Document migration from Electron version
   - [ ] Explain settings migration
   - [ ] Provide rollback instructions

**Estimated Time**: 3-5 days
**Dependencies**: Stage 8 complete
**Testing**: Full acceptance testing

---

## Timeline Summary

| Stage | Duration | Dependencies | Priority |
|-------|----------|--------------|----------|
| 1. Transcription Providers | 2-3 weeks | None | HIGH |
| 2. Enhanced Settings | 1-2 weeks | Stage 1 | HIGH |
| 3. Voice Commands | 2 weeks | Stage 1 | MEDIUM |
| 4. Grammar Correction | 1 week | Stage 1 | MEDIUM |
| 5. Compact Mode | 3-4 days | None | LOW |
| 6. UI Polish | 1 week | All above | MEDIUM |
| 7. Advanced Features | 1-2 weeks | All above | LOW |
| 8. Bug Fixes | 1-2 weeks | All above | HIGH |
| 9. Documentation | 3-5 days | Stage 8 | HIGH |

**Total Estimated Time**: 10-14 weeks (2.5-3.5 months)

---

## Success Criteria

### Functional Parity
- ✅ All transcription providers working
- ✅ All voice commands working
- ✅ Grammar correction working
- ✅ Settings persistence working
- ✅ All keyboard shortcuts working

### UI Parity
- ✅ Identical visual appearance
- ✅ Same animations and transitions
- ✅ Same color scheme and fonts
- ✅ Same window behavior

### Performance Goals
- ✅ Startup time < 2 seconds
- ✅ Bundle size < 50MB
- ✅ Memory usage < 100MB
- ✅ No focus stealing issues

### Quality Standards
- ✅ No critical bugs
- ✅ All features tested
- ✅ Documentation complete
- ✅ Installer working

---

## Risk Mitigation

### High-Risk Items
1. **Window Focus Issue**
   - **Risk**: May not be solvable in Tauri
   - **Mitigation**: Ensure keyboard shortcuts work perfectly as alternative

2. **Native Keyboard Injection**
   - **Risk**: Windows API complexity
   - **Mitigation**: Use clipboard as fallback, test extensively

3. **Streaming Providers**
   - **Risk**: WebSocket complexity in Rust
   - **Mitigation**: Use proven libraries, test incrementally

### Medium-Risk Items
1. **Voice Command Accuracy**
   - **Mitigation**: Port exact logic from Electron, extensive testing

2. **UI Pixel-Perfect Match**
   - **Mitigation**: Use same CSS values, side-by-side comparison

---

## Rollout Strategy

### Phase 1: Internal Testing (Stages 1-4)
- Use alongside Electron version
- Test core functionality
- Gather feedback

### Phase 2: Beta Release (Stages 5-7)
- Release to select users
- Monitor for issues
- Iterate based on feedback

### Phase 3: Production Release (Stages 8-9)
- Full public release
- Deprecate Electron version
- Provide migration path

---

## Maintenance Plan

### Post-Release
- Monitor crash reports
- Fix critical bugs within 24 hours
- Release patches as needed
- Plan feature updates

### Long-Term
- Keep dependencies updated
- Add new providers as they emerge
- Improve performance continuously
- Gather user feedback for enhancements

---

## Notes

- Each stage should be committed to git separately
- Test thoroughly before moving to next stage
- Update this document as progress is made
- Mark completed tasks with ✅
- Document any deviations from plan
