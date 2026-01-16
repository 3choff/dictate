use std::collections::HashMap;

/// Italian voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation - Punteggiatura
    commands.insert("punto".to_string(), ".".to_string());
    commands.insert("virgola".to_string(), ",".to_string());
    commands.insert("punto esclamativo".to_string(), "!".to_string());
    commands.insert("punto interrogativo".to_string(), "?".to_string());
    
    // Other common - Altri comuni
    commands.insert("due punti".to_string(), ":".to_string());
    commands.insert("punto e virgola".to_string(), ";".to_string());
    commands.insert("trattino".to_string(), "-".to_string());
    commands.insert("chiocciola".to_string(), "@".to_string());
    commands.insert("apri parentesi".to_string(), "(".to_string());
    commands.insert("chiudi parentesi".to_string(), ")".to_string());
    commands.insert("apri virgolette".to_string(), "\"".to_string());
    commands.insert("chiudi virgolette".to_string(), "\"".to_string());
    commands.insert("apri apice".to_string(), "'".to_string());
    commands.insert("chiudi apice".to_string(), "'".to_string());
    commands.insert("segno uguale".to_string(), "=".to_string());
    
    // Key commands - Comandi tasto
    commands.insert("cancella".to_string(), "backspace".to_string());
    commands.insert("premi invio".to_string(), "enter".to_string());
    commands.insert("premi a capo".to_string(), "enter".to_string());
    commands.insert("premi incolla".to_string(), "ctrl+v".to_string());
    commands.insert("premi copia".to_string(), "ctrl+c".to_string());
    commands.insert("premi salva".to_string(), "ctrl+s".to_string());
    commands.insert("premi annulla".to_string(), "ctrl+z".to_string());
    commands.insert("premi ripeti".to_string(), "ctrl+y".to_string());
    commands.insert("premi taglia".to_string(), "ctrl+x".to_string());
    commands.insert("seleziona tutto".to_string(), "ctrl+a".to_string());
    commands.insert("deseleziona".to_string(), "right".to_string());
    commands.insert("seleziona nessuno".to_string(), "right".to_string());
    commands.insert("premi spazio".to_string(), "space".to_string());
    commands.insert("premi tab".to_string(), "tab".to_string());
    commands.insert("elimina".to_string(), "delete_last_word".to_string());
    commands.insert("rimuovi".to_string(), "delete_last_word".to_string());
    commands.insert("premi riscrivi".to_string(), "rewrite".to_string());
    commands.insert("premi correggi".to_string(), "rewrite".to_string());
    commands.insert("pausa dettatura".to_string(), "pause_dictation".to_string());
    commands.insert("ferma dettatura".to_string(), "pause_dictation".to_string());
    commands.insert("stop dettatura".to_string(), "pause_dictation".to_string());
    commands.insert("smetti di ascoltare".to_string(), "pause_dictation".to_string());
    
    commands
}
