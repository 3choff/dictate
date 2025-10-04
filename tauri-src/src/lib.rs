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

            // Apply Windows-specific no-activate style to prevent focus stealing
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                use raw_window_handle::{HasWindowHandle, RawWindowHandle};
                
                if let Ok(handle) = window.window_handle() {
                    if let RawWindowHandle::Win32(win32_handle) = handle.as_raw() {
                        let hwnd = win32_handle.hwnd.get() as isize;
                        println!("[SETUP] Applying WS_EX_NOACTIVATE to main window");
                        let _ = services::windows_focus::set_window_no_activate(hwnd);
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::transcribe_audio,
            commands::transcribe_audio_segment,
            commands::insert_text,
            commands::copy_selected_text,
            commands::correct_grammar,
            commands::get_settings,
            commands::save_settings,
            commands::open_settings_window,
            commands::exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
