use std::collections::HashMap;

/// Japanese voice commands
pub fn commands() -> HashMap<String, String> {
    let mut commands = HashMap::new();
    
    // Punctuation - 句読点
    commands.insert("まる".to_string(), "。".to_string());
    commands.insert("句点".to_string(), "。".to_string());
    commands.insert("てん".to_string(), "、".to_string());
    commands.insert("読点".to_string(), "、".to_string());
    commands.insert("感嘆符".to_string(), "!".to_string());
    commands.insert("びっくりマーク".to_string(), "!".to_string());
    commands.insert("疑問符".to_string(), "?".to_string());
    commands.insert("はてなマーク".to_string(), "?".to_string());
    
    // Other common - その他
    commands.insert("コロン".to_string(), ":".to_string());
    commands.insert("セミコロン".to_string(), ";".to_string());
    commands.insert("ハイフン".to_string(), "-".to_string());
    commands.insert("アットマーク".to_string(), "@".to_string());
    commands.insert("かっこ開く".to_string(), "(".to_string());
    commands.insert("括弧開く".to_string(), "(".to_string());
    commands.insert("かっこ閉じる".to_string(), ")".to_string());
    commands.insert("括弧閉じる".to_string(), ")".to_string());
    commands.insert("引用符開く".to_string(), "\"".to_string());
    commands.insert("引用符閉じる".to_string(), "\"".to_string());
    commands.insert("イコール".to_string(), "=".to_string());
    
    // Key commands - キーコマンド
    commands.insert("削除".to_string(), "backspace".to_string());
    commands.insert("バックスペース".to_string(), "backspace".to_string());
    commands.insert("改行を押す".to_string(), "enter".to_string());
    commands.insert("エンターを押す".to_string(), "enter".to_string());
    commands.insert("貼り付けを押す".to_string(), "ctrl+v".to_string());
    commands.insert("ペーストを押す".to_string(), "ctrl+v".to_string());
    commands.insert("コピーを押す".to_string(), "ctrl+c".to_string());
    commands.insert("保存を押す".to_string(), "ctrl+s".to_string());
    commands.insert("元に戻すを押す".to_string(), "ctrl+z".to_string());
    commands.insert("やり直すを押す".to_string(), "ctrl+y".to_string());
    commands.insert("切り取りを押す".to_string(), "ctrl+x".to_string());
    commands.insert("すべて選択".to_string(), "ctrl+a".to_string());
    commands.insert("全選択".to_string(), "ctrl+a".to_string());
    commands.insert("スペースを押す".to_string(), "space".to_string());
    commands.insert("タブを押す".to_string(), "tab".to_string());
    commands.insert("それを削除".to_string(), "delete_last_word".to_string());
    commands.insert("取り消し".to_string(), "delete_last_word".to_string());
    commands.insert("書き直しを押す".to_string(), "rewrite".to_string());
    commands.insert("修正を押す".to_string(), "rewrite".to_string());
    commands.insert("音声入力を停止".to_string(), "pause_dictation".to_string());
    commands.insert("ディクテーション停止".to_string(), "pause_dictation".to_string());
    commands.insert("聞くのをやめる".to_string(), "pause_dictation".to_string());
    
    commands
}
