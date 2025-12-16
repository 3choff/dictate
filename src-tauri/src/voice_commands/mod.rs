use std::collections::HashMap;
use regex::Regex;

mod en;
mod it;
mod es;
mod fr;
mod de;
mod pt;
mod ja;
mod nl;
mod zh;
mod ru;

pub struct VoiceCommands {
    commands: HashMap<String, String>,
}

impl VoiceCommands {
    /// Create voice commands for a specific transcription language
    /// Falls back to English for unsupported languages or "multilingual"
    pub fn new_with_language(language: &str) -> Self {
        let commands = match language {
            "it" => it::commands(),
            "es" => es::commands(),
            "fr" => fr::commands(),
            "de" => de::commands(),
            "pt" => pt::commands(),
            "ja" => ja::commands(),
            "nl" => nl::commands(),
            "zh" => zh::commands(),
            "ru" => ru::commands(),
            _ => en::commands(),  // English default for "en", "multilingual", or unknown
        };
        Self { commands }
    }
    

    
    pub fn get_commands(&self) -> &HashMap<String, String> {
        &self.commands
    }
}

#[derive(Debug)]
pub enum CommandAction {
    InsertText(String),      // Punctuation or text to insert
    KeyPress(String),        // Single key (enter, backspace, space, tab)
    KeyCombo(String, String), // Modifier + key (ctrl+c, etc.)
    DeleteLastWord,          // Special: delete last word
    Rewrite,                 // Special: trigger text rewrite
    PauseDictation,          // Special: pause/stop dictation
}

impl CommandAction {
    pub fn from_action_string(action: &str) -> Self {
        match action {
            "enter" => CommandAction::KeyPress("enter".to_string()),
            "backspace" => CommandAction::KeyPress("backspace".to_string()),
            "space" => CommandAction::KeyPress("space".to_string()),
            "tab" => CommandAction::KeyPress("tab".to_string()),
            "delete_last_word" => CommandAction::DeleteLastWord,
            "rewrite" => CommandAction::Rewrite,
            "pause_dictation" => CommandAction::PauseDictation,
            _ if action.contains('+') => {
                let parts: Vec<&str> = action.split('+').collect();
                if parts.len() == 2 {
                    let modifier = parts[0].to_lowercase();
                    let key = parts[1].to_lowercase();
                    // Normalize 'ctrl' to 'control' for enigo
                    let modifier = if modifier == "ctrl" {
                        "control".to_string()
                    } else {
                        modifier
                    };
                    CommandAction::KeyCombo(modifier, key)
                } else {
                    CommandAction::InsertText(action.to_string())
                }
            }
            _ => CommandAction::InsertText(action.to_string()),
        }
    }
}

pub struct ProcessedText {
    pub remaining_text: String,
    pub processed_text: String,
    pub actions: Vec<CommandAction>,
    pub had_key_action: bool,
}

pub fn process_voice_commands(text: &str, voice_commands: &VoiceCommands) -> ProcessedText {
    let mut remaining = text.trim().to_string();
    let mut processed = String::new();
    let mut actions = Vec::new();
    let mut had_key_action = false;
    
    // Process each voice command
    for (phrase, action) in voice_commands.get_commands() {
        // Escape regex special characters
        let escaped = regex::escape(phrase);
        // Create word boundary regex (case insensitive)
        let pattern = format!(r"\b{}\b", escaped);
        
        if let Ok(re) = Regex::new(&format!("(?i){}", pattern)) {
            let cmd_action = CommandAction::from_action_string(action);
            
            // Handle special cases that need different processing
            match &cmd_action {
                CommandAction::DeleteLastWord => {
                    // Remove the command phrase and delete last word before it
                    if re.is_match(&remaining) {
                        remaining = re.replace_all(&remaining, "").to_string();
                        // Remove last word from processed text
                        let words: Vec<&str> = processed.trim().split_whitespace().collect();
                        if !words.is_empty() {
                            processed = words[..words.len() - 1].join(" ");
                            if !processed.is_empty() {
                                processed.push(' ');
                            }
                        }
                        actions.push(cmd_action);
                        had_key_action = true;
                    }
                }
                CommandAction::Rewrite | CommandAction::PauseDictation => {
                    // Remove the command phrase and add action
                    if re.is_match(&remaining) {
                        remaining = re.replace_all(&remaining, "").to_string().trim().to_string();
                        processed = processed.trim_end().to_string();
                        actions.push(cmd_action);
                        had_key_action = true;
                    }
                }
                CommandAction::KeyPress(_) | CommandAction::KeyCombo(_, _) => {
                    // Remove the command phrase and add key action
                    remaining = re.replace_all(&remaining, "").to_string();
                    if re.is_match(text) {
                        actions.push(cmd_action);
                        had_key_action = true;
                    }
                }
                CommandAction::InsertText(text) => {
                    // Replace command phrase with punctuation/text
                    if re.is_match(&remaining) {
                        remaining = re.replace_all(&remaining, "").to_string();
                        processed.push_str(text);
                        processed.push(' ');
                    }
                }
            }
        }
    }
    
    ProcessedText {
        remaining_text: remaining.trim().to_string(),
        processed_text: processed,
        actions,
        had_key_action,
    }
}
