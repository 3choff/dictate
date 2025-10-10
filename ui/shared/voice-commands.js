const voiceCommands = {
  // Punctuation
  "period": ".",
  "comma": ",",
  "exclamation mark": "!",
  "question mark": "?",

  // Other common
  "colon": ":",
  "semicolon": ";",
  "dash": "-",
  "hyphen": "-",
  "at sign": "@", 
  "at mention": "@",
  "open parenthesis": "(",
  "close parenthesis": ")",
  "open quote": '"',
  "close quote": '"',
  "open single quote": "'",
  "close single quote": "'",
  "equal sign": "=",

  // Key commands
  "backspace": "backspace",
  "press enter": "enter",
  "press paste": "ctrl+v",
  "press copy": "ctrl+c",
  "press save": "ctrl+s",
  "press undo": "ctrl+z",
  "press redo": "ctrl+y",
  "press cut": "ctrl+x",
  "select all": "ctrl+a",
  "press space": "space",
  "press tab": "tab",
  "delete that": "delete_last_word",
  "remove that": "delete_last_word",
  "correct grammar": "grammar_correct",
  "correct the grammar": "grammar_correct",
  "pause voice typing": "pause_dictation",
  "pause dictation": "pause_dictation",
  "stop voice typing": "pause_dictation",
  "stop dictation": "pause_dictation",
  "stop listening": "pause_dictation",
  "stop dictating": "pause_dictation",
  "stop voice mode": "pause_dictation",
  "pause voice mode": "pause_dictation",
};

// Export for use in Tauri frontend
if (typeof window !== 'undefined') {
  window.voiceCommands = voiceCommands;
}
