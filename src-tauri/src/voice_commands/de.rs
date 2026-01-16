use std::collections::HashMap;

/// German voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation - Satzzeichen
    commands.insert("punkt".to_string(), ".".to_string());
    commands.insert("komma".to_string(), ",".to_string());
    commands.insert("ausrufezeichen".to_string(), "!".to_string());
    commands.insert("fragezeichen".to_string(), "?".to_string());
    
    // Other common - Andere häufige
    commands.insert("doppelpunkt".to_string(), ":".to_string());
    commands.insert("semikolon".to_string(), ";".to_string());
    commands.insert("strichpunkt".to_string(), ";".to_string());
    commands.insert("bindestrich".to_string(), "-".to_string());
    commands.insert("gedankenstrich".to_string(), "-".to_string());
    commands.insert("at zeichen".to_string(), "@".to_string());
    commands.insert("klammeraffe".to_string(), "@".to_string());
    commands.insert("klammer auf".to_string(), "(".to_string());
    commands.insert("klammer zu".to_string(), ")".to_string());
    commands.insert("anführungszeichen auf".to_string(), "\"".to_string());
    commands.insert("anführungszeichen zu".to_string(), "\"".to_string());
    commands.insert("gleich zeichen".to_string(), "=".to_string());
    
    // Key commands - Tastenbefehle
    commands.insert("löschen".to_string(), "backspace".to_string());
    commands.insert("rücktaste".to_string(), "backspace".to_string());
    commands.insert("drücke eingabe".to_string(), "enter".to_string());
    commands.insert("drücke enter".to_string(), "enter".to_string());
    commands.insert("drücke neue zeile".to_string(), "enter".to_string());
    commands.insert("drücke einfügen".to_string(), "ctrl+v".to_string());
    commands.insert("drücke kopieren".to_string(), "ctrl+c".to_string());
    commands.insert("drücke speichern".to_string(), "ctrl+s".to_string());
    commands.insert("drücke rückgängig".to_string(), "ctrl+z".to_string());
    commands.insert("drücke wiederholen".to_string(), "ctrl+y".to_string());
    commands.insert("drücke ausschneiden".to_string(), "ctrl+x".to_string());
    commands.insert("alles auswählen".to_string(), "ctrl+a".to_string());
    commands.insert("alles markieren".to_string(), "ctrl+a".to_string());
    commands.insert("Auswahl aufheben".to_string(), "right".to_string());
    commands.insert("nichts auswählen".to_string(), "right".to_string());
    commands.insert("drücke leerzeichen".to_string(), "space".to_string());
    commands.insert("drücke tabulator".to_string(), "tab".to_string());
    commands.insert("das löschen".to_string(), "delete_last_word".to_string());
    commands.insert("entfernen".to_string(), "delete_last_word".to_string());
    commands.insert("drücke umschreiben".to_string(), "rewrite".to_string());
    commands.insert("drücke korrigieren".to_string(), "rewrite".to_string());
    commands.insert("diktat pausieren".to_string(), "pause_dictation".to_string());
    commands.insert("diktat stoppen".to_string(), "pause_dictation".to_string());
    commands.insert("aufhören zu hören".to_string(), "pause_dictation".to_string());
    
    commands
}
