# Dictate

![Dictate Demo](https://github.com/3choff/dictate/blob/master/assets/demo/demo.gif?raw=true)

Dictate is an Electron-based desktop dictation application for Windows, inspired by the familiar UI of Windows Voice Typing. It aims to enhance the user experience by integrating more powerful and effective speech-to-text services, allowing users to record audio, transcribe it, and seamlessly paste the transcription into any active application. With features like global hotkeys, audio cues, and voice commands, Dictate streamlines your workflow and boosts productivity.

**Version:** 0.6.7
**All changes will be documented in the `CHANGELOG.md` file.**

## Features

*   **Desktop Dictation:** Record your voice and have it transcribed into text.
*   **Seamless Text Insertion:** Automatically pastes or types the transcribed text into your active application.
*   **Standalone Windows Executable:** Packaged as a portable `.exe` for easy distribution and use.
*   **Interactive Settings:** Configure API keys, transcription services (Deepgram, Cartesia, Groq, Gemini, Mistral, SambaNova, Fireworks), grammar correction provider (Groq, Gemini, Mistral, SambaNova, Fireworks), transcription language, and text insertion modes through a dedicated settings window.
*   **Help & Support:** Quick access to the project's GitHub page via a help button.
*   **Global Hotkey:** Use `Ctrl+Shift+D` to toggle recording (start/stop) from anywhere on your system.
*   **Grammar Correction:** Select any text in any app and click the sparkle button (or press `Ctrl+Shift+G`) to correct grammar with your chosen provider (default: Groq). Click again while pulsing to abort.
*   **Audio Cues:** Audible "beep" on starting recording and "clack" on stopping recording for clear feedback.
*   **Multiple Transcription Services:**
    *   **Groq:** Silence-based chunking with continuous capture; sends WAV segments on ~1s silence.
    *   **Deepgram:** Real-time streaming transcription for lower latency.
    *   **Cartesia:** Real-time streaming transcription using a dedicated PCM pipeline.
    *   **Gemini:** Non‑streaming transcription via Google Gemini API using inline audio.
    *   **Mistral:** Non‑streaming transcription via Mistral Audio Transcriptions API (multipart/form-data).
    *   **SambaNova:** Non‑streaming transcription via SambaNova Whisper-Large-v3 endpoint.
    *   **Fireworks:** Non‑streaming transcription via Fireworks Whisper endpoint.
*   **Multilingual Understanding:** Pick a default transcription language in settings. Providers that accept language hints receive it automatically; leaving the selector on `Multilingual` falls back to each provider's auto-detect mode.
    * Deepgram streams with `language=multi`.
    * Groq Whisper (whisper-large-v3-turbo) auto-detects language.
    * Gemini Flash Lite handles multilingual audio.
    * Mistral Voxtral receives the selected language when provided.
    * SambaNova Whisper receives the selected language when provided.
*   **Text Formatting Control:** Single "Text formatted" setting controls output:
    * Non‑streaming providers (Groq, Gemini, Mistral): when unchecked, the app normalizes transcript (lowercase + removes punctuation). When checked, transcript is preserved.
    * Streaming provider (Deepgram): toggles the `smart_format` request parameter to match the setting.
*   **Flexible Text Insertion:** Choose between native Windows SendKeys or clipboard-based insertion for compatibility.
*   **Voice Commands:** Execute rich text manipulation actions (e.g., "press enter", "backspace", "delete that", "select all", "correct grammar") and system shortcuts entirely through voice, with an in-app toggle to enable or disable them. Commands now apply consistently to both streaming and non-streaming providers.

## Installation

To set up and run Dictate:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/3choff/dictate.git
    cd dictate
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Build the application (for a portable Windows executable):**
    ```bash
    npm run build
    ```
    The portable executable will be generated in the `dist` folder.

## Usage

### Running the Application

*   **Development Mode:** To run the app in development mode:
    ```bash
    npm start
    ```
    Use `Ctrl+Shift+L` to toggle DevTools and verbose logs.
*   **Packaged Application:** After building, navigate to the `dist` folder and run the `Dictate 0.6.7.exe` (or similar) executable.

### Window Views

Right-click anywhere on the main window to quickly toggle between the compact and expanded layouts.

### Recording and Transcribing

1.  **Launch Dictate.**
2.  **Global Hotkey:** Press `Ctrl+Shift+D` to start recording. You will hear a "beep" sound.
3.  **Speak:** Dictate your text.
4.  **Stop Recording:** Press `Ctrl+Shift+D` again to stop recording or say "stop listening". You will hear a "clack" sound.
5.  **Text Insertion:** The transcribed text will automatically be pasted into your currently active application.
   * Groq, Mistral, SambaNova, Fireworks, Gemini: Speak, pause ~1s to emit a segment; text is inserted per segment.
   * Deepgram and Cartesia: Inserts finalized phrases as they arrive in streaming mode.

### Settings

Click the gear icon in the Dictate window to open the settings. Here you can:
*   Enter your API keys for Groq, Deepgram, Cartesia, Gemini, Mistral, SambaNova, and Fireworks.
*   Select your preferred transcription service and transcription language (or leave `Multilingual`).
*   Select grammar correction provider (Groq GPT-OSS-120B, Gemini 2.5 Flash, Mistral Small, Llama-3.3-70B, or Fireworks GPT-OSS-20B). Default is Groq.
*   Choose your text insertion mode (Simulated Typing via SendKeys or Clipboard paste).
*   Toggle "Text formatted" to control normalized vs. formatted output for both providers (Groq normalization, Deepgram `smart_format`).

### Voice Commands

Dictate supports several voice commands for hands-free text manipulation. The full list of available commands is defined once in `src/shared/voice-commands.js` and used across Groq, Deepgram, Cartesia, and other providers. Here are a few examples:

*   **Punctuation:** "period" (.), "comma" (,), "question mark" (?)
*   **Key Presses:** "press enter", "backspace", "press space", "press tab"
*   **Control Combinations:** "press control plus c" (Ctrl+C), "press control plus v" (Ctrl+V)
*   **Text Manipulation:** "delete that" (removes the most recent word), "select all" (Ctrl+A)
*   **Grammar:** "correct grammar" / "correct the grammar" (selects all text and runs the grammar shortcut)
*   **Dictation Controls:** "pause voice typing", "stop dictation", "pause voice mode", etc. (sends Ctrl+Shift+D to pause voice typing)

## Development Notes

*   **Debug Toggle:** Use `Ctrl+Shift+L` to open DevTools and enable verbose logs; press again to disable.

## License

This project is licensed under the Apache License 2.0.
