# Dictate

![Dictate Demo](https://github.com/3choff/dictate/blob/master/assets/demo/demo.gif?raw=true)

Dictate is an Electron-based desktop dictation application for Windows, inspired by the familiar UI of Windows Voice Typing. It aims to enhance the user experience by integrating more powerful and effective speech-to-text services, allowing users to record audio, transcribe it, and seamlessly paste the transcription into any active application. With features like global hotkeys, audio cues, and voice commands, Dictate streamlines your workflow and boosts productivity.

**Version:** 0.2.0
**All changes will be documented in the `CHANGELOG.md` file.**

## Features

*   **Desktop Dictation:** Record your voice and have it transcribed into text.
*   **Seamless Text Insertion:** Automatically pastes transcribed text into your active application.
*   **Standalone Windows Executable:** Packaged as a portable `.exe` for easy distribution and use.
*   **Interactive Settings:** Configure API keys, transcription services (Groq, Deepgram), and text insertion modes through a dedicated settings window.
*   **Help & Support:** Quick access to the project's GitHub page via a help button.
*   **Global Hotkey:** Use `Ctrl+Shift+H` to toggle recording (start/stop) from anywhere on your system.
*   **Audio Cues:** Audible "beep" on starting recording and "clack" on stopping recording for clear feedback.
*   **Multiple Transcription Services:**
    *   **Groq:** Silence-based chunking with continuous capture; sends WAV segments on ~1s silence.
    *   **Deepgram:** Real-time streaming transcription for lower latency.
*   **Flexible Text Insertion:** Choose between native Windows SendKeys or clipboard-based insertion for compatibility.
*   **Voice Commands:** Execute common text manipulation actions (e.g., "enter", "backspace", "delete last word", "control C") directly through voice.

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
    Use `Ctrl+Shift+D` to toggle DevTools and verbose logs.
*   **Packaged Application:** After building, navigate to the `dist` folder and run the `Dictate 0.2.0.exe` (or similar) executable.

### Recording and Transcribing

1.  **Launch Dictate.**
2.  **Global Hotkey:** Press `Ctrl+Shift+H` to start recording. You will hear a "beep" sound.
3.  **Speak:** Dictate your text.
4.  **Stop Recording:** Press `Ctrl+Shift+H` again to stop recording. You will hear a "clack" sound.
5.  **Text Insertion:** The transcribed text will automatically be pasted into your currently active application.
   * Groq: Speak, pause ~1s to emit a segment; text is inserted per segment.
   * Deepgram: Inserts finalized phrases as they arrive in streaming mode.

### Settings

Click the gear icon in the Dictate window to open the settings. Here you can:
*   Enter your API keys for Groq and Deepgram.
*   Select your preferred transcription service.
*   Choose your text insertion mode (Native or Clipboard).

### Voice Commands

Dictate supports several voice commands for hands-free text manipulation. The full list of available commands can be found in `src/shared/voice-commands.js`. Here are a few examples:

*   **Punctuation:** "period" (.), "comma" (,), "question mark" (?)
*   **Key Presses:** "press enter", "backspace", "press space", "press tab"
*   **Control Combinations:** "press control plus c" (Ctrl+C), "press control plus v" (Ctrl+V)
*   **Text Manipulation:** "delete that" (deletes the last word)

## Development Notes

*   **Asset Paths:** Audio assets are bundled under `assets/` and resolved via base64 or file URL depending on environment.
*   **Icon:** The Windows icon is configured in `package.json` at `assets/icon/icon.ico`.
*   **Debug Toggle:** Use `Ctrl+Shift+D` to open DevTools and enable verbose logs; press again to disable.

## Contributing

(Add contributing guidelines here if applicable)

## Troubleshooting

*   **No audio cues:** Ensure `assets/` is present in packaged app. We use `extraResources` to ship assets.
*   **No Groq transcription:** Verify Groq API Key in Settings and watch the terminal for segment logs. Toggle logs with `Ctrl+Shift+D`.

## License

This project is licensed under the Apache License 2.0.
