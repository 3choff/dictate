use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

mod commands;
mod providers;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // Register Ctrl+Shift+D for recording toggle
            let shortcut: Shortcut = "Ctrl+Shift+D".parse().unwrap();
            app.global_shortcut().on_shortcut(shortcut, |app, _event, _shortcut| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("toggle-recording", ());
                }
            })?;

            // Register Ctrl+Shift+L for DevTools toggle
            let debug_shortcut: Shortcut = "Ctrl+Shift+L".parse().unwrap();
            app.global_shortcut().on_shortcut(debug_shortcut, |app, _event, _shortcut| {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_devtools_open() {
                        let _ = window.close_devtools();
                    } else {
                        let _ = window.open_devtools();
                    }
                }
            })?;

            // Window focus is controlled by the "focus": false setting in tauri.conf.json

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::transcribe_audio,
            commands::insert_text,
            commands::prevent_focus,
            commands::get_settings,
            commands::save_settings,
            commands::open_settings_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
