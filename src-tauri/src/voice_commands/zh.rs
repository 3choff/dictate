use std::collections::HashMap;

/// Chinese voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation - 标点符号
    commands.insert("句号".to_string(), "。".to_string());
    commands.insert("逗号".to_string(), "，".to_string());
    commands.insert("感叹号".to_string(), "!".to_string());
    commands.insert("叹号".to_string(), "!".to_string());
    commands.insert("问号".to_string(), "?".to_string());
    
    // Other common - 其他常用
    commands.insert("冒号".to_string(), ":".to_string());
    commands.insert("分号".to_string(), ";".to_string());
    commands.insert("破折号".to_string(), "-".to_string());
    commands.insert("连字符".to_string(), "-".to_string());
    commands.insert("艾特".to_string(), "@".to_string());
    commands.insert("左括号".to_string(), "(".to_string());
    commands.insert("右括号".to_string(), ")".to_string());
    commands.insert("左引号".to_string(), "\"".to_string());
    commands.insert("右引号".to_string(), "\"".to_string());
    commands.insert("等号".to_string(), "=".to_string());
    
    // Key commands - 键盘命令
    commands.insert("删除".to_string(), "backspace".to_string());
    commands.insert("退格".to_string(), "backspace".to_string());
    commands.insert("按下 回车".to_string(), "enter".to_string());
    commands.insert("按下 换行".to_string(), "enter".to_string());
    commands.insert("按下 粘贴".to_string(), "ctrl+v".to_string());
    commands.insert("按下 复制".to_string(), "ctrl+c".to_string());
    commands.insert("按下 保存".to_string(), "ctrl+s".to_string());
    commands.insert("按下 撤销".to_string(), "ctrl+z".to_string());
    commands.insert("按下 重做".to_string(), "ctrl+y".to_string());
    commands.insert("按下 剪切".to_string(), "ctrl+x".to_string());
    commands.insert("全选".to_string(), "ctrl+a".to_string());
    commands.insert("取消选择".to_string(), "right".to_string());
    commands.insert("不选择".to_string(), "right".to_string());
    commands.insert("按下 空格".to_string(), "space".to_string());
    commands.insert("按下 制表符".to_string(), "tab".to_string());
    commands.insert("删除那个".to_string(), "delete_last_word".to_string());
    commands.insert("移除那个".to_string(), "delete_last_word".to_string());
    commands.insert("按下 重写".to_string(), "rewrite".to_string());
    commands.insert("按下 修正".to_string(), "rewrite".to_string());
    commands.insert("暂停听写".to_string(), "pause_dictation".to_string());
    commands.insert("停止听写".to_string(), "pause_dictation".to_string());
    commands.insert("停止听".to_string(), "pause_dictation".to_string());
    
    commands
}
