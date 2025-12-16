use std::collections::HashMap;

/// Portuguese voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation - Pontuação
    commands.insert("ponto".to_string(), ".".to_string());
    commands.insert("ponto final".to_string(), ".".to_string());
    commands.insert("vírgula".to_string(), ",".to_string());
    commands.insert("ponto de exclamação".to_string(), "!".to_string());
    commands.insert("exclamação".to_string(), "!".to_string());
    commands.insert("ponto de interrogação".to_string(), "?".to_string());
    commands.insert("interrogação".to_string(), "?".to_string());
    
    // Other common - Outros comuns
    commands.insert("dois pontos".to_string(), ":".to_string());
    commands.insert("ponto e vírgula".to_string(), ";".to_string());
    commands.insert("hífen".to_string(), "-".to_string());
    commands.insert("travessão".to_string(), "-".to_string());
    commands.insert("arroba".to_string(), "@".to_string());
    commands.insert("abrir parênteses".to_string(), "(".to_string());
    commands.insert("fechar parênteses".to_string(), ")".to_string());
    commands.insert("abrir aspas".to_string(), "\"".to_string());
    commands.insert("fechar aspas".to_string(), "\"".to_string());
    commands.insert("sinal de igual".to_string(), "=".to_string());
    
    // Key commands - Comandos de tecla
    commands.insert("apagar".to_string(), "backspace".to_string());
    commands.insert("retroceder".to_string(), "backspace".to_string());
    commands.insert("pressionar enter".to_string(), "enter".to_string());
    commands.insert("pressionar nova linha".to_string(), "enter".to_string());
    commands.insert("pressionar colar".to_string(), "ctrl+v".to_string());
    commands.insert("pressionar copiar".to_string(), "ctrl+c".to_string());
    commands.insert("pressionar salvar".to_string(), "ctrl+s".to_string());
    commands.insert("pressionar guardar".to_string(), "ctrl+s".to_string());
    commands.insert("pressionar desfazer".to_string(), "ctrl+z".to_string());
    commands.insert("pressionar refazer".to_string(), "ctrl+y".to_string());
    commands.insert("pressionar cortar".to_string(), "ctrl+x".to_string());
    commands.insert("selecionar tudo".to_string(), "ctrl+a".to_string());
    commands.insert("pressionar espaço".to_string(), "space".to_string());
    commands.insert("pressionar tabulação".to_string(), "tab".to_string());
    commands.insert("eliminar isso".to_string(), "delete_last_word".to_string());
    commands.insert("remover isso".to_string(), "delete_last_word".to_string());
    commands.insert("pressionar reescrever".to_string(), "rewrite".to_string());
    commands.insert("pressionar corrigir".to_string(), "rewrite".to_string());
    commands.insert("pausar ditado".to_string(), "pause_dictation".to_string());
    commands.insert("parar ditado".to_string(), "pause_dictation".to_string());
    commands.insert("parar de ouvir".to_string(), "pause_dictation".to_string());
    
    commands
}
