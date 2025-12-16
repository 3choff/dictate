use std::collections::HashMap;

/// Spanish voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation - Puntuación
    commands.insert("punto".to_string(), ".".to_string());
    commands.insert("coma".to_string(), ",".to_string());
    commands.insert("signo de exclamación".to_string(), "!".to_string());
    commands.insert("exclamación".to_string(), "!".to_string());
    commands.insert("signo de interrogación".to_string(), "?".to_string());
    commands.insert("interrogación".to_string(), "?".to_string());
    
    // Other common - Otros comunes
    commands.insert("dos puntos".to_string(), ":".to_string());
    commands.insert("punto y coma".to_string(), ";".to_string());
    commands.insert("guión".to_string(), "-".to_string());
    commands.insert("arroba".to_string(), "@".to_string());
    commands.insert("abrir paréntesis".to_string(), "(".to_string());
    commands.insert("cerrar paréntesis".to_string(), ")".to_string());
    commands.insert("abrir comillas".to_string(), "\"".to_string());
    commands.insert("cerrar comillas".to_string(), "\"".to_string());
    commands.insert("signo igual".to_string(), "=".to_string());
    
    // Key commands - Comandos de tecla
    commands.insert("borrar".to_string(), "backspace".to_string());
    commands.insert("retroceso".to_string(), "backspace".to_string());
    commands.insert("presionar enter".to_string(), "enter".to_string());
    commands.insert("presionar intro".to_string(), "enter".to_string());
    commands.insert("presionar nueva línea".to_string(), "enter".to_string());
    commands.insert("presionar pegar".to_string(), "ctrl+v".to_string());
    commands.insert("presionar copiar".to_string(), "ctrl+c".to_string());
    commands.insert("presionar guardar".to_string(), "ctrl+s".to_string());
    commands.insert("presionar deshacer".to_string(), "ctrl+z".to_string());
    commands.insert("presionar rehacer".to_string(), "ctrl+y".to_string());
    commands.insert("presionar cortar".to_string(), "ctrl+x".to_string());
    commands.insert("seleccionar todo".to_string(), "ctrl+a".to_string());
    commands.insert("presionar espacio".to_string(), "space".to_string());
    commands.insert("presionar tabulador".to_string(), "tab".to_string());
    commands.insert("eliminar eso".to_string(), "delete_last_word".to_string());
    commands.insert("quitar eso".to_string(), "delete_last_word".to_string());
    commands.insert("presionar reescribir".to_string(), "rewrite".to_string());
    commands.insert("presionar corregir".to_string(), "rewrite".to_string());
    commands.insert("pausar dictado".to_string(), "pause_dictation".to_string());
    commands.insert("detener dictado".to_string(), "pause_dictation".to_string());
    commands.insert("parar dictado".to_string(), "pause_dictation".to_string());
    commands.insert("dejar de escuchar".to_string(), "pause_dictation".to_string());
    
    commands
}
