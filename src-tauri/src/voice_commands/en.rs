use std::collections::HashMap;

/// English voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation
    commands.insert("period".to_string(), ".".to_string());
    commands.insert("comma".to_string(), ",".to_string());
    commands.insert("exclamation mark".to_string(), "!".to_string());
    commands.insert("question mark".to_string(), "?".to_string());
    
    // Other common
    commands.insert("colon".to_string(), ":".to_string());
    commands.insert("semicolon".to_string(), ";".to_string());
    commands.insert("dash".to_string(), "-".to_string());
    commands.insert("hyphen".to_string(), "-".to_string());
    commands.insert("at sign".to_string(), "@".to_string());
    commands.insert("at mention".to_string(), "@".to_string());
    commands.insert("open parenthesis".to_string(), "(".to_string());
    commands.insert("close parenthesis".to_string(), ")".to_string());
    commands.insert("open quote".to_string(), "\"".to_string());
    commands.insert("close quote".to_string(), "\"".to_string());
    commands.insert("open single quote".to_string(), "'".to_string());
    commands.insert("close single quote".to_string(), "'".to_string());
    commands.insert("equal sign".to_string(), "=".to_string());
    
    // Key commands
    commands.insert("backspace".to_string(), "backspace".to_string());
    commands.insert("press enter".to_string(), "enter".to_string());
    commands.insert("press paste".to_string(), "ctrl+v".to_string());
    commands.insert("press copy".to_string(), "ctrl+c".to_string());
    commands.insert("press save".to_string(), "ctrl+s".to_string());
    commands.insert("press undo".to_string(), "ctrl+z".to_string());
    commands.insert("press redo".to_string(), "ctrl+y".to_string());
    commands.insert("press cut".to_string(), "ctrl+x".to_string());
    commands.insert("select all".to_string(), "ctrl+a".to_string());
    commands.insert("select none".to_string(), "right".to_string());
    commands.insert("deselect".to_string(), "right".to_string());
    commands.insert("press space".to_string(), "space".to_string());
    commands.insert("press tab".to_string(), "tab".to_string());
    commands.insert("delete that".to_string(), "delete_last_word".to_string());
    commands.insert("remove that".to_string(), "delete_last_word".to_string());
    commands.insert("press rewrite".to_string(), "rewrite".to_string());
    commands.insert("pause voice typing".to_string(), "pause_dictation".to_string());
    commands.insert("pause dictation".to_string(), "pause_dictation".to_string());
    commands.insert("stop voice typing".to_string(), "pause_dictation".to_string());
    commands.insert("stop dictation".to_string(), "pause_dictation".to_string());
    commands.insert("stop listening".to_string(), "pause_dictation".to_string());
    commands.insert("stop dictating".to_string(), "pause_dictation".to_string());
    commands.insert("stop voice mode".to_string(), "pause_dictation".to_string());
    commands.insert("pause voice mode".to_string(), "pause_dictation".to_string());
    
    commands
}
