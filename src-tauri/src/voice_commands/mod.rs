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

    /// Helper to efficiently strip punctuation for command matching
    fn clean_text_for_matching(text: &str) -> String {
        text.to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect()
    }

    /// Check if the given text exactly matches a voice command phrase (case-insensitive).
    /// Also checks with spaces collapsed to handle Voxtral word fragmentation
    /// (e.g., "ex clamation mark" matches "exclamation mark").
    pub fn is_exact_command(&self, text: &str) -> bool {
        let lower = Self::clean_text_for_matching(text);
        let collapsed = lower.replace(" ", "");
        self.commands.keys().any(|phrase| {
            let phrase_lower = phrase.to_lowercase();
            phrase_lower == lower || phrase_lower.replace(" ", "") == collapsed
        })
    }

    /// Check if the given text is a prefix of any voice command phrase (case-insensitive).
    /// Also checks with spaces collapsed for Voxtral word fragmentation.
    pub fn is_command_prefix(&self, text: &str) -> bool {
        let lower = Self::clean_text_for_matching(text);
        let collapsed = lower.replace(" ", "");
        self.commands.keys().any(|phrase| {
            let phrase_lower = phrase.to_lowercase();
            let phrase_collapsed = phrase_lower.replace(" ", "");
            // Standard prefix check: "press" is a prefix of "press enter"
            let is_standard_prefix = phrase_lower.starts_with(&format!("{} ", lower));
            // Collapsed prefix check: "ex cla" collapsed to "excla" is a prefix of "exclamationmark"
            let is_collapsed_prefix = phrase_collapsed.starts_with(&collapsed) && collapsed != phrase_collapsed;
            is_standard_prefix || is_collapsed_prefix
        })
    }

    /// If the buffer (possibly fragmented) matches a command when spaces are collapsed,
    /// return the correct command phrase. Used to fix the buffer before processing.
    pub fn reconstruct_command(&self, text: &str) -> Option<String> {
        let lower = Self::clean_text_for_matching(text);
        let collapsed = lower.replace(" ", "");
        self.commands.keys().find(|phrase| {
            phrase.to_lowercase().replace(" ", "") == collapsed
        }).cloned()
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
            "right" => CommandAction::KeyPress("right".to_string()),
            "left" => CommandAction::KeyPress("left".to_string()),
            "up" => CommandAction::KeyPress("up".to_string()),
            "down" => CommandAction::KeyPress("down".to_string()),
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
    pub had_any_command: bool,
}

pub fn process_voice_commands(text: &str, voice_commands: &VoiceCommands) -> ProcessedText {
    // Keep original casing for text that gets inserted as dictation
    let mut remaining = text.trim().to_string();
    // Lowercase copy used only for command detection (models may capitalize first words)
    let mut remaining_lower = remaining.to_lowercase();
    let mut processed = String::new();
    let mut actions = Vec::new();
    let mut had_key_action = false;
    let mut had_any_command = false;
    
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
                    if re.is_match(&remaining_lower) {
                        remaining = re.replace_all(&remaining, "").to_string();
                        remaining_lower = remaining.to_lowercase();
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
                        had_any_command = true;
                    }
                }
                CommandAction::Rewrite | CommandAction::PauseDictation => {
                    // Remove the command phrase and add action
                    if re.is_match(&remaining_lower) {
                        remaining = re.replace_all(&remaining, "").to_string().trim().to_string();
                        remaining_lower = remaining.to_lowercase();
                        processed = processed.trim_end().to_string();
                        actions.push(cmd_action);
                        had_key_action = true;
                        had_any_command = true;
                    }
                }
                CommandAction::KeyPress(_) | CommandAction::KeyCombo(_, _) => {
                    // Remove the command phrase and add key action
                    if re.is_match(&remaining_lower) {
                        remaining = re.replace_all(&remaining, "").to_string();
                        remaining_lower = remaining.to_lowercase();
                        actions.push(cmd_action);
                        had_key_action = true;
                        had_any_command = true;
                    }
                }
                CommandAction::InsertText(text) => {
                    // Replace command phrase with punctuation/text
                    if re.is_match(&remaining_lower) {
                        remaining = re.replace_all(&remaining, "").to_string();
                        remaining_lower = remaining.to_lowercase();
                        processed.push_str(text);
                        processed.push(' ');
                        had_any_command = true;
                    }
                }
            }
        }
    }
    
    // After a voice command, the model often adds trailing punctuation (. ,)
    // because the user paused after speaking the command. Strip it.
    let mut final_remaining = remaining.trim().to_string();
    if had_any_command {
        // Remove trailing period/comma that the model added after the command
        final_remaining = final_remaining.trim_end_matches(|c: char| c == '.' || c == ',').trim().to_string();
        // Also remove leading period/comma (command was at the end of the chunk)
        final_remaining = final_remaining.trim_start_matches(|c: char| c == '.' || c == ',').trim().to_string();
    }
    
    ProcessedText {
        remaining_text: final_remaining,
        processed_text: processed,
        actions,
        had_key_action,
        had_any_command,
    }
}
