const { app, BrowserWindow, ipcMain, clipboard, shell, globalShortcut } = require('electron');
const path = require('path');
const robot = require('robotjs');
const fs = require('fs');
const { transcribeAudio, rewriteTextGroq } = require('../shared/providers/groq.js');
const { transcribeAudioGemini, rewriteTextGemini } = require('../shared/providers/gemini.js');
const { transcribeAudioMistral, rewriteTextMistral } = require('../shared/providers/mistral.js');
const { transcribeAudioSambaNova, rewriteTextSambaNova } = require('../shared/providers/sambanova.js');
const { transcribeAudioFireworks, rewriteTextFireworks } = require('../shared/providers/fireworks.js');
const { getWhisperLanguage } = require('../shared/language-map.js');
const { injectTextNative } = require('./win-inject.js');
const { voiceCommands } = require('../shared/voice-commands.js');

// Insertion mode: 'native' (Windows SendKeys), or 'clipboard' for maximum compatibility
const INSERTION_MODE = 'clipboard';

let store;
let mainWindow;
let settingsWindow;
let settingsWindowContentSize = { width: 300, height: 400 };
// Track in-flight sparkle requests per renderer (by webContents id)
const sparkleRequests = new Map(); // id -> { controller, originalClipboard }
let debugLogsEnabled = false; // toggled via Ctrl+Shift+D

// Rewriting prompts (future configurable map)
const REWRITE_PROMPTS = {
  grammar: 'Rewrite the following text with correct grammar and punctuation while preserving the original meaning. Return only the corrected text with no extra commentary.',
};
const DEFAULT_REWRITE_MODE = 'grammar';
const DEFAULT_GRAMMAR_PROVIDER = 'groq';

function debugLog(...args) {
  if (debugLogsEnabled) console.log(...args);
}

function formatGroqTranscript(text) {
  // When preserveFormatting is false: lowercase and strip punctuation
  const preserve = store.get('preserveFormatting', true);
  if (preserve) return text;
  try {
    const lower = text.toLowerCase();
    // Remove most punctuation characters, keep letters/numbers/spaces
    const cleaned = lower
      .normalize('NFKC')
      .replace(/[.,\/#!$%\^&*;:{}=_'`~()\[\]"<>?@+|\\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  } catch (_) {
    return text.toLowerCase();
  }
}

// Unified command parsing and text insertion for both providers
async function processAndInject(inputText) {
  if (!inputText || typeof inputText !== 'string' || !inputText.trim()) return;
  try {
    let remainingText = inputText.trim();
    let processed = '';
    let didKeyAction = false; // enter/backspace/tab/space/ctrl+ combos/delete_last_word

    // Parse and execute voice commands first
    for (const [phrase, action] of Object.entries(voiceCommands)) {
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'gi');
      remainingText = remainingText.replace(regex, () => {
        if (action === 'enter') {
          robot.keyTap('enter');
          didKeyAction = true;
        } else if (action === 'backspace') {
          robot.keyTap('backspace');
          didKeyAction = true;
        } else if (action === 'space') {
          robot.keyTap('space');
          didKeyAction = true;
        } else if (action === 'tab') {
          robot.keyTap('tab');
          didKeyAction = true;
        } else if (action === 'delete_last_word') {
          const words = remainingText.trim().split(/\s+/);
          if (words.length > 1) {
            words.pop();
            remainingText = words.join(' ');
          } else {
            remainingText = '';
          }
          didKeyAction = true;
        } else if (action.startsWith('ctrl+')) {
          const keys = action.split('+');
          robot.keyTap(keys[1], keys[0]);
          didKeyAction = true;
        } else {
          // Treat punctuation or text tokens as literal insertions (with trailing space)
          processed += action + ' ';
        }
        return '';
      });
    }

    // Insert remaining text, ensuring spacing policy
    const rem = remainingText.trim();
    const hasProcessed = processed.trim().length > 0;

    if (rem) {
      if (hasProcessed) {
        await injectAccordingToSettings(rem);
        await injectAccordingToSettings(processed);
      } else {
        await injectAccordingToSettings(didKeyAction ? rem : rem + ' ');
      }
    } else if (hasProcessed) {
      await injectAccordingToSettings(processed);
    }
  } catch (err) {
    console.error('processAndInject error', err);
  }
}

async function initialize() {
  const { default: Store } = await import('electron-store');
  store = new Store();

  // Register IPC handlers after the store is initialized
  ipcMain.handle('get-settings', () => {
    return {
      apiKey: store.get('apiKey', ''), // legacy
      groqApiKey: store.get('groqApiKey', ''),
      deepgramApiKey: store.get('deepgramApiKey', ''),
      geminiApiKey: store.get('geminiApiKey', ''),
      mistralApiKey: store.get('mistralApiKey', ''),
      sambanovaApiKey: store.get('sambanovaApiKey', ''),
      fireworksApiKey: store.get('fireworksApiKey', ''),
      apiService: store.get('apiService', 'groq'),
      insertionMode: store.get('insertionMode', 'clipboard'),
      preserveFormatting: store.get('preserveFormatting', true),
      grammarProvider: store.get('grammarProvider', 'groq'),
      transcriptionLanguage: store.get('transcriptionLanguage', 'multilingual'),
    };
  });

  // Provide renderer with a file:// URL for an asset, works in dev and packaged apps.
  ipcMain.handle('get-asset-file-url', (event, relativePath) => {
    try {
      // relativePath example: 'assets/audio/beep.mp3'
      let filePath;
      if (app.isPackaged) {
        // In packaged app, extraResources are in the resources directory
        filePath = path.join(process.resourcesPath, relativePath);
      } else {
        // In development, resolve relative to project root (src/main -> ../../)
        // __dirname is src/main, project root is two levels up from there.
        filePath = path.resolve(__dirname, '..', '..', relativePath);
      }
      const normalized = filePath.replace(/\\/g, '/');
      return `file://${normalized}`;
    } catch (err) {
      console.error('get-asset-file-url error', err);
      return '';
    }
  });

  // Handle Groq segments produced by renderer-side silence-based chunking
  ipcMain.on('save-audio-segment', async (event, audioData) => {
    try {
      const buffer = Buffer.from(audioData);
      debugLog('[Groq] Received segment:', buffer.length, 'bytes');
      const provider = store.get('apiService', 'groq');
      const selection = store.get('transcriptionLanguage', 'multilingual');
      const whisperLanguage = getWhisperLanguage(selection);
      let transcription = null;
      if (provider === 'gemini') {
        const key = store.get('geminiApiKey', '');
        transcription = await transcribeAudioGemini(buffer, key);
      } else if (provider === 'mistral') {
        const key = store.get('mistralApiKey', '');
        transcription = await transcribeAudioMistral(buffer, key, { language: whisperLanguage });
      } else if (provider === 'sambanova') {
        const key = store.get('sambanovaApiKey', '');
        transcription = await transcribeAudioSambaNova(buffer, key, { language: whisperLanguage });
      } else if (provider === 'fireworks') {
        const key = store.get('fireworksApiKey', '');
        transcription = await transcribeAudioFireworks(buffer, key, { language: whisperLanguage });
      } else {
        const key = store.get('groqApiKey', '');
        transcription = await transcribeAudio(buffer, key, { language: whisperLanguage });
      }
      if (transcription && transcription.text) {
        debugLog('[Groq] Transcription received:', transcription.text);
        const normalized = formatGroqTranscript(transcription.text).trim();
        await processAndInject(normalized);
      } else {
        debugLog('[Groq] No transcription text returned for segment');
      }
    } catch (e) {
      console.error('save-audio-segment error', e);
    }
  });

  ipcMain.on('set-settings', (event, settings) => {
    // Persist legacy apiKey if provided
    if (typeof settings.apiKey === 'string') {
      store.set('apiKey', settings.apiKey);
    }
    // Persist per-provider keys
    if (typeof settings.groqApiKey === 'string') {
      store.set('groqApiKey', settings.groqApiKey);
    }
    if (typeof settings.deepgramApiKey === 'string') {
      store.set('deepgramApiKey', settings.deepgramApiKey);
    }
    if (typeof settings.geminiApiKey === 'string') {
      store.set('geminiApiKey', settings.geminiApiKey);
    }
    if (typeof settings.mistralApiKey === 'string') {
      store.set('mistralApiKey', settings.mistralApiKey);
    }
    if (typeof settings.sambanovaApiKey === 'string') {
      store.set('sambanovaApiKey', settings.sambanovaApiKey);
    }
    if (typeof settings.fireworksApiKey === 'string') {
      store.set('fireworksApiKey', settings.fireworksApiKey);
    }
    store.set('apiService', settings.apiService);
    if (typeof settings.transcriptionLanguage === 'string') {
      store.set('transcriptionLanguage', settings.transcriptionLanguage);
    }
    if (settings.insertionMode === 'native' || settings.insertionMode === 'clipboard') {
      store.set('insertionMode', settings.insertionMode);
    }
    if (typeof settings.preserveFormatting === 'boolean') {
      store.set('preserveFormatting', settings.preserveFormatting);
    }
    if (typeof settings.grammarProvider === 'string') {
      store.set('grammarProvider', settings.grammarProvider);
    }
  });

  ipcMain.on('open-settings-window', () => {
    if (settingsWindow) {
      settingsWindow.close();
      return;
    }

    const mainWindowBounds = mainWindow.getBounds();
    const settingsWidth = settingsWindowContentSize?.width || 300;
    const gap = 10;
    settingsWindow = new BrowserWindow({
      width: settingsWidth,
      height: settingsWindowContentSize?.height || 400,
      x: mainWindowBounds.x - settingsWidth - gap,
      y: mainWindowBounds.y,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, '../renderer/settings/settings-preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    settingsWindow.loadFile(path.join(__dirname, '../renderer/settings/settings.html'));

    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });
  });

  ipcMain.on('settings-size', (event, size) => {
    if (!settingsWindow || !size) return;
    const { width, height } = size;
    if (typeof width === 'number' && typeof height === 'number') {
      const paddedWidth = Math.ceil(width);
      const paddedHeight = Math.ceil(height);
      settingsWindowContentSize = { width: paddedWidth, height: paddedHeight };
      settingsWindow.setContentSize(paddedWidth, paddedHeight);
      const mainWindowBounds = mainWindow?.getBounds();
      if (mainWindowBounds) {
        const gap = 10;
        settingsWindow.setPosition(mainWindowBounds.x - paddedWidth - gap, mainWindowBounds.y);
      }
    }
  });

  ipcMain.on('close-settings-window', () => {
    if (settingsWindow) {
      settingsWindow.close();
    }
  });

  ipcMain.on('save-audio', async (event, audioData) => {
    const buffer = Buffer.from(audioData);
    const provider = store.get('apiService', 'groq');
    const selection = store.get('transcriptionLanguage', 'multilingual');
    const whisperLanguage = getWhisperLanguage(selection);
    let transcription = null;
    if (provider === 'gemini') {
      const key = store.get('geminiApiKey', '');
      transcription = await transcribeAudioGemini(buffer, key);
    } else if (provider === 'mistral') {
      const key = store.get('mistralApiKey', '');
      transcription = await transcribeAudioMistral(buffer, key, { language: whisperLanguage });
    } else if (provider === 'sambanova') {
      const key = store.get('sambanovaApiKey', '');
      transcription = await transcribeAudioSambaNova(buffer, key, { language: whisperLanguage });
    } else if (provider === 'fireworks') {
      const key = store.get('fireworksApiKey', '');
      transcription = await transcribeAudioFireworks(buffer, key, { language: whisperLanguage });
    } else {
      const key = store.get('groqApiKey', '');
      transcription = await transcribeAudio(buffer, key, { language: whisperLanguage });
    }

    if (transcription && transcription.text) {
      const text = formatGroqTranscript(transcription.text).trim();
      await processAndInject(text);
    }
  });

  // Sparkle action: rewrite selected text via chosen provider (abortable)
  ipcMain.on('sparkle-correct-selection', async (event) => {
    try {
      const provider = store.get('grammarProvider', DEFAULT_GRAMMAR_PROVIDER);
      const prompt = REWRITE_PROMPTS[DEFAULT_REWRITE_MODE];

      let apiKey;
      if (provider === 'groq') {
        apiKey = store.get('groqApiKey', '');
      } else if (provider === 'gemini') {
        apiKey = store.get('geminiApiKey', '');
      } else if (provider === 'mistral') {
        apiKey = store.get('mistralApiKey', '');
      } else if (provider === 'sambanova') {
        apiKey = store.get('sambanovaApiKey', '');
      } else if (provider === 'fireworks') {
        apiKey = store.get('fireworksApiKey', '');
      } else {
        apiKey = '';
      }
      if (!apiKey) { event.sender.send('sparkle-correct-done'); return; } // silent no-op

      // Copy current selection
      const originalClipboard = clipboard.readText();
      const controller = new AbortController();
      const senderId = event.sender.id;
      // Save request state so we can abort later
      sparkleRequests.set(senderId, { controller, originalClipboard });
      robot.keyTap('c', 'control');
      await new Promise((r) => setTimeout(r, 200));
      if (controller.signal.aborted) {
        try { if (clipboard.readText() !== originalClipboard) clipboard.writeText(originalClipboard); } catch (_) {}
        sparkleRequests.delete(senderId);
        event.sender.send('sparkle-correct-done');
        return;
      }
      const selectedText = clipboard.readText();
      if (!selectedText || !selectedText.trim()) {
        // restore and exit silently
        if (clipboard.readText() !== originalClipboard) clipboard.writeText(originalClipboard);
        sparkleRequests.delete(senderId);
        event.sender.send('sparkle-correct-done');
        return;
      }

      // Rewrite selection via chosen provider
      const req = sparkleRequests.get(senderId);
      const signal = req ? req.controller.signal : undefined;
      let corrected = null;
      if (provider === 'groq') {
        corrected = await rewriteTextGroq(selectedText, prompt, apiKey, signal);
      } else if (provider === 'gemini') {
        corrected = await rewriteTextGemini(selectedText, prompt, apiKey, signal);
      } else if (provider === 'mistral') {
        corrected = await rewriteTextMistral(selectedText, prompt, apiKey, signal);
      } else if (provider === 'sambanova') {
        corrected = await rewriteTextSambaNova(selectedText, prompt, apiKey, signal);
      } else if (provider === 'fireworks') {
        corrected = await rewriteTextFireworks(selectedText, prompt, apiKey, signal);
      }
      if (!corrected || !corrected.trim()) {
        // restore and exit silently
        if (clipboard.readText() !== originalClipboard) clipboard.writeText(originalClipboard);
        sparkleRequests.delete(senderId);
        event.sender.send('sparkle-correct-done');
        return;
      }

      // Replace selection by pasting corrected text
      clipboard.writeText(corrected);
      robot.keyTap('v', 'control');
      // notify renderer that we're done (response received and paste issued)
      sparkleRequests.delete(senderId);
      event.sender.send('sparkle-correct-done');
      setTimeout(() => {
        // restore clipboard shortly after paste
        if (clipboard.readText() === corrected) {
          clipboard.writeText(originalClipboard);
        } else {
          // Best effort restore even if current clipboard changed
          clipboard.writeText(originalClipboard);
        }
      }, 300);
    } catch (e) {
      // Silent by design
      try {
        const senderId = event.sender.id;
        const entry = sparkleRequests.get(senderId);
        if (entry) {
          try { if (clipboard.readText() !== entry.originalClipboard) clipboard.writeText(entry.originalClipboard); } catch (_) {}
          sparkleRequests.delete(senderId);
        }
        event.sender.send('sparkle-correct-done');
      } catch (_) {}
      return;
    }
  });

  // Abort current sparkle request for this renderer
  ipcMain.on('sparkle-abort', (event) => {
    try {
      const senderId = event.sender.id;
      const entry = sparkleRequests.get(senderId);
      if (!entry) { event.sender.send('sparkle-correct-done'); return; }
      entry.controller.abort();
      try { if (clipboard.readText() !== entry.originalClipboard) clipboard.writeText(entry.originalClipboard); } catch (_) {}
      sparkleRequests.delete(senderId);
      event.sender.send('sparkle-correct-done');
    } catch (_) {
      try { event.sender.send('sparkle-correct-done'); } catch (_) {}
    }
  });

  // Provide renderer with base64 encoded asset data for reliable loading in packaged apps
  ipcMain.handle('get-asset-base64', async (event, relativePath) => {
    try {
      let filePath;
      if (app.isPackaged) {
        // In packaged app, extraResources are in the resources directory
        filePath = path.join(process.resourcesPath, relativePath);
      } else {
        filePath = path.resolve(__dirname, '..', '..', relativePath);
      }
      const data = fs.readFileSync(filePath);
      return data.toString('base64');
    } catch (err) {
      console.error('get-asset-base64 error', err);
      return null;
    }
  });

  app.whenReady().then(() => {
    createMainWindow();

    // Recording toggle: Ctrl+Shift+D
    globalShortcut.register('Control+Shift+D', () => {
      if (!mainWindow) {
        createMainWindow();
        // Give a moment for the window to be ready before sending the IPC
        setTimeout(() => {
          if (mainWindow) {
            mainWindow.webContents.send('toggle-mic');
          }
        }, 500);
      } else {
        mainWindow.webContents.send('toggle-mic');
      }
    });

    // Debug: Ctrl+Shift+H toggles DevTools and debug log mode for renderer/main
    globalShortcut.register('Control+Shift+L', () => {
      if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
        debugLogsEnabled = !debugLogsEnabled;
        mainWindow.webContents.send('debug-mode', debugLogsEnabled);
        debugLog('[Debug] Debug logs enabled:', debugLogsEnabled);
      }
    });

    // Grammar correction: Ctrl+Shift+G triggers sparkle action in renderer
    globalShortcut.register('Control+Shift+G', () => {
      if (!mainWindow) {
        createMainWindow();
        setTimeout(() => {
          if (mainWindow) mainWindow.webContents.send('sparkle-trigger');
        }, 500);
      } else {
        mainWindow.webContents.send('sparkle-trigger');
      }
    });

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 160,
    height: 100,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/main/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/main/index.html'));
  // Send initial debug mode state when renderer is ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('debug-mode', debugLogsEnabled);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function injectAccordingToSettings(text) {
  const insertionMode = store.get('insertionMode', 'clipboard');
  if (insertionMode === 'native') {
    try {
      await injectTextNative(text);
    } catch (e) {
      console.error('Native injection failed; falling back to clipboard paste', e);
      // Fallback to clipboard approach if native injection fails
      const originalClipboard = clipboard.readText();
      clipboard.writeText(text);
      robot.keyTap('v', 'control');
      setTimeout(() => {
        if (clipboard.readText() === text) {
          clipboard.writeText(originalClipboard);
        }
      }, 500);
    }
  } else if (insertionMode === 'clipboard') {
    // Clipboard mode: temporary clipboard write, paste, then restore
    const originalClipboard = clipboard.readText();
    clipboard.writeText(text);
    robot.keyTap('v', 'control');
    setTimeout(() => {
      if (clipboard.readText() === text) {
        clipboard.writeText(originalClipboard);
      }
    }, 500);
  } else {
    // Default to clipboard if mode is unknown
    const originalClipboard = clipboard.readText();
    clipboard.writeText(text);
    robot.keyTap('v', 'control');
    setTimeout(() => {
      if (clipboard.readText() === text) {
        clipboard.writeText(originalClipboard);
      }
    }, 500);
  }
}

ipcMain.handle('insert-text', async (event, text) => {
  if (!text || typeof text !== 'string' || !text.trim()) return;
  try {
    let remainingText = text.trim();
    let processed = '';
    let didKeyAction = false; // enter/backspace/tab/space/ctrl+ combos/delete_last_word

    // First, check for command phrases
    for (const [phrase, action] of Object.entries(voiceCommands)) {
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      remainingText = remainingText.replace(regex, (match) => {
        if (action === 'enter') {
          robot.keyTap('enter');
          didKeyAction = true;
        } else if (action === 'backspace') {
          robot.keyTap('backspace');
          didKeyAction = true;
        } else if (action === 'space') {
          robot.keyTap('space');
          didKeyAction = true;
        } else if (action === 'tab') {
          robot.keyTap('tab');
          didKeyAction = true;
        } else if (action === 'delete_last_word') {
          // Delete the last word in remainingText
          const words = remainingText.trim().split(/\s+/);
          if (words.length > 1) {
            words.pop();
            remainingText = words.join(' ');
          } else {
            remainingText = '';
          }
          didKeyAction = true;
        } else if (action.startsWith('ctrl+')) {
          const keys = action.split('+');
          robot.keyTap(keys[1], keys[0]);
          didKeyAction = true;
        } else {
          // Treat as text to insert (e.g., punctuation). Preserve trailing space here.
          processed += action + ' ';
        }
        return ''; // Remove the command from text
      });
    }

    // Insert using user-selected insertion mode while ensuring a trailing separator when appropriate
    const rem = remainingText.trim();
    const hasProcessed = processed.trim().length > 0;

    if (rem) {
      if (hasProcessed) {
        // Inject remaining words first (no trailing space), then processed which already has a trailing space
        await injectAccordingToSettings(rem);
        await injectAccordingToSettings(processed);
      } else {
        // No punctuation/text produced. Append a trailing space only if no key action happened.
        await injectAccordingToSettings(didKeyAction ? rem : rem + ' ');
      }
    } else if (hasProcessed) {
      // Only punctuation/text produced; keep its trailing space
      await injectAccordingToSettings(processed);
    }
  } catch (err) {
    console.error('insert-text error', err);
  }
});

ipcMain.on('close-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
});

ipcMain.on('open-external-link', (event, url) => {
    shell.openExternal(url);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    globalShortcut.unregisterAll(); // Unregister all shortcuts
    app.quit();
  }
});

initialize();
