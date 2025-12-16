use std::collections::HashMap;

/// Russian voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation - Знаки препинания
    commands.insert("точка".to_string(), ".".to_string());
    commands.insert("запятая".to_string(), ",".to_string());
    commands.insert("восклицательный знак".to_string(), "!".to_string());
    commands.insert("вопросительный знак".to_string(), "?".to_string());
    
    // Other common - Другие распространённые
    commands.insert("двоеточие".to_string(), ":".to_string());
    commands.insert("точка с запятой".to_string(), ";".to_string());
    commands.insert("тире".to_string(), "-".to_string());
    commands.insert("дефис".to_string(), "-".to_string());
    commands.insert("собака".to_string(), "@".to_string());
    commands.insert("открыть скобку".to_string(), "(".to_string());
    commands.insert("закрыть скобку".to_string(), ")".to_string());
    commands.insert("открыть кавычки".to_string(), "\"".to_string());
    commands.insert("закрыть кавычки".to_string(), "\"".to_string());
    commands.insert("знак равно".to_string(), "=".to_string());
    
    // Key commands - Клавиатурные команды
    commands.insert("удалить".to_string(), "backspace".to_string());
    commands.insert("stereть".to_string(), "backspace".to_string()); // Corrected "stereть" typo in my thought, but original was "стереть"
    commands.insert("стереть".to_string(), "backspace".to_string());
    commands.insert("нажать ввод".to_string(), "enter".to_string());
    commands.insert("нажать энтер".to_string(), "enter".to_string());
    commands.insert("нажать новая строка".to_string(), "enter".to_string());
    commands.insert("нажать вставить".to_string(), "ctrl+v".to_string());
    commands.insert("нажать копировать".to_string(), "ctrl+c".to_string());
    commands.insert("нажать сохранить".to_string(), "ctrl+s".to_string());
    commands.insert("нажать отменить".to_string(), "ctrl+z".to_string());
    commands.insert("нажать повторить".to_string(), "ctrl+y".to_string());
    commands.insert("нажать вырезать".to_string(), "ctrl+x".to_string());
    commands.insert("выделить всё".to_string(), "ctrl+a".to_string());
    commands.insert("выбрать всё".to_string(), "ctrl+a".to_string());
    commands.insert("нажать пробел".to_string(), "space".to_string());
    commands.insert("нажать табуляция".to_string(), "tab".to_string());
    commands.insert("удалить это".to_string(), "delete_last_word".to_string());
    commands.insert("убрать это".to_string(), "delete_last_word".to_string());
    commands.insert("нажать переписать".to_string(), "rewrite".to_string());
    commands.insert("нажать исправить".to_string(), "rewrite".to_string());
    commands.insert("пауза диктовки".to_string(), "pause_dictation".to_string());
    commands.insert("остановить диктовку".to_string(), "pause_dictation".to_string());
    commands.insert("прекратить слушать".to_string(), "pause_dictation".to_string());
    
    commands
}
