use std::collections::HashMap;

/// Dutch voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation - Leestekens
    commands.insert("punt".to_string(), ".".to_string());
    commands.insert("komma".to_string(), ",".to_string());
    commands.insert("uitroepteken".to_string(), "!".to_string());
    commands.insert("vraagteken".to_string(), "?".to_string());
    
    // Other common - Andere veelvoorkomende
    commands.insert("dubbele punt".to_string(), ":".to_string());
    commands.insert("puntkomma".to_string(), ";".to_string());
    commands.insert("streepje".to_string(), "-".to_string());
    commands.insert("koppelteken".to_string(), "-".to_string());
    commands.insert("apenstaartje".to_string(), "@".to_string());
    commands.insert("haakje openen".to_string(), "(".to_string());
    commands.insert("haakje sluiten".to_string(), ")".to_string());
    commands.insert("aanhalingsteken openen".to_string(), "\"".to_string());
    commands.insert("aanhalingsteken sluiten".to_string(), "\"".to_string());
    commands.insert("is gelijk teken".to_string(), "=".to_string());
    
    // Key commands - Toetsopdrachten
    commands.insert("wissen".to_string(), "backspace".to_string());
    commands.insert("backspace".to_string(), "backspace".to_string());
    commands.insert("druk op enter".to_string(), "enter".to_string());
    commands.insert("druk op nieuwe regel".to_string(), "enter".to_string());
    commands.insert("druk op plakken".to_string(), "ctrl+v".to_string());
    commands.insert("druk op kopiëren".to_string(), "ctrl+c".to_string());
    commands.insert("druk op opslaan".to_string(), "ctrl+s".to_string());
    commands.insert("druk op ongedaan maken".to_string(), "ctrl+z".to_string());
    commands.insert("druk op opnieuw".to_string(), "ctrl+y".to_string());
    commands.insert("druk op knippen".to_string(), "ctrl+x".to_string());
    commands.insert("alles selecteren".to_string(), "ctrl+a".to_string());
    commands.insert("druk op spatie".to_string(), "space".to_string());
    commands.insert("druk op tab".to_string(), "tab".to_string());
    commands.insert("verwijder dat".to_string(), "delete_last_word".to_string());
    commands.insert("dat verwijderen".to_string(), "delete_last_word".to_string());
    commands.insert("druk op herschrijven".to_string(), "rewrite".to_string());
    commands.insert("druk op corrigeren".to_string(), "rewrite".to_string());
    commands.insert("dictaat pauzeren".to_string(), "pause_dictation".to_string());
    commands.insert("dictaat stoppen".to_string(), "pause_dictation".to_string());
    commands.insert("stop met luisteren".to_string(), "pause_dictation".to_string());
    
    commands
}
