use std::collections::HashMap;

/// French voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation - Ponctuation
    commands.insert("point".to_string(), ".".to_string());
    commands.insert("virgule".to_string(), ",".to_string());
    commands.insert("point d'exclamation".to_string(), "!".to_string());
    commands.insert("point d'interrogation".to_string(), "?".to_string());
    
    // Other common - Autres courants
    commands.insert("deux points".to_string(), ":".to_string());
    commands.insert("point-virgule".to_string(), ";".to_string());
    commands.insert("tiret".to_string(), "-".to_string());
    commands.insert("trait d'union".to_string(), "-".to_string());
    commands.insert("arobase".to_string(), "@".to_string());
    commands.insert("ouvrir parenthèse".to_string(), "(".to_string());
    commands.insert("fermer parenthèse".to_string(), ")".to_string());
    commands.insert("ouvrir guillemets".to_string(), "\"".to_string());
    commands.insert("fermer guillemets".to_string(), "\"".to_string());
    commands.insert("signe égal".to_string(), "=".to_string());
    
    // Key commands - Commandes clavier
    commands.insert("effacer".to_string(), "backspace".to_string());
    commands.insert("retour arrière".to_string(), "backspace".to_string());
    commands.insert("appuyer sur entrée".to_string(), "enter".to_string());
    commands.insert("appuyer sur nouvelle ligne".to_string(), "enter".to_string());
    commands.insert("appuyer sur à la ligne".to_string(), "enter".to_string());
    commands.insert("appuyer sur coller".to_string(), "ctrl+v".to_string());
    commands.insert("appuyer sur copier".to_string(), "ctrl+c".to_string());
    commands.insert("appuyer sur enregistrer".to_string(), "ctrl+s".to_string());
    commands.insert("appuyer sur sauvegarder".to_string(), "ctrl+s".to_string());
    commands.insert("appuyer sur annuler".to_string(), "ctrl+z".to_string());
    commands.insert("appuyer sur rétablir".to_string(), "ctrl+y".to_string());
    commands.insert("appuyer sur couper".to_string(), "ctrl+x".to_string());
    commands.insert("tout sélectionner".to_string(), "ctrl+a".to_string());
    commands.insert("appuyer sur espace".to_string(), "space".to_string());
    commands.insert("appuyer sur tabulation".to_string(), "tab".to_string());
    commands.insert("supprimer ça".to_string(), "delete_last_word".to_string());
    commands.insert("effacer ça".to_string(), "delete_last_word".to_string());
    commands.insert("appuyer sur réécrire".to_string(), "rewrite".to_string());
    commands.insert("appuyer sur corriger".to_string(), "rewrite".to_string());
    commands.insert("pause dictée".to_string(), "pause_dictation".to_string());
    commands.insert("arrêter dictée".to_string(), "pause_dictation".to_string());
    commands.insert("stop dictée".to_string(), "pause_dictation".to_string());
    commands.insert("arrêter d'écouter".to_string(), "pause_dictation".to_string());
    
    commands
}
