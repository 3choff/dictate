# Dictate

Dictate is an Electron-based desktop dictation application for Windows, inspired by the familiar UI of Windows Voice Typing. It aims to enhance the user experience by integrating more powerful and effective speech-to-text services, allowing users to record audio, transcribe it, and seamlessly paste the transcription into any active application. With features like global hotkeys, audio cues, and voice commands, Dictate streamlines your workflow and boosts productivity.

**Version:** 0.1.0
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
    *   **Groq:** Supports file-based transcription.
    *   **Deepgram:** Supports real-time streaming transcription for lower latency.
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

*   **Development Mode:** To run the app in development mode (with DevTools enabled):
    ```bash
    npm start
    ```
*   **Packaged Application:** After building, navigate to the `dist` folder and run the `Dictate 0.1.0.exe` (or similar) executable.

### Recording and Transcribing

1.  **Launch Dictate.**
2.  **Global Hotkey:** Press `Ctrl+Shift+H` to start recording. You will hear a "beep" sound.
3.  **Speak:** Dictate your text.
4.  **Stop Recording:** Press `Ctrl+Shift+H` again to stop recording. You will hear a "clack" sound.
5.  **Text Insertion:** The transcribed text will automatically be pasted into your currently active application.

### Settings

Click the gear icon in the Dictate window to open the settings. Here you can:
*   Enter your API keys for Groq and Deepgram.
*   Select your preferred transcription service.
*   Choose your text insertion mode (Native or Clipboard).

### Voice Commands

Dictate supports several voice commands for hands-free text manipulation. Simply speak these phrases during recording:
*   "Enter" - Presses the Enter key.
*   "Backspace" - Presses the Backspace key.
*   "Space" - Presses the Spacebar.
*   "Tab" - Presses the Tab key.
*   "Delete last word" - Deletes the last word typed.
*   "Control C" - Presses `Ctrl+C`.
*   "Control V" - Presses `Ctrl+V`.
*   (More commands can be added in `src/shared/voice-commands.js`)

## Development Notes

*   **Asset Paths:** Audio assets are loaded using a base64 encoding method to ensure reliability in both development and packaged environments.
*   **Icon:** The application icon is configured in `package.json` and located in the `build/icon.ico` path for optimal `electron-builder` compatibility.

## Contributing

(Add contributing guidelines here if applicable)

## Future Implementations

*   **Voice Activity Detection (VAD) for Groq:** Integrate a VAD system to chunk audio dynamically, allowing for more efficient and responsive transcription when using the Groq provider. This will enable near real-time transcription for Groq, similar to Deepgram's streaming capabilities.

## License

This project is licensed under the ISC License.
