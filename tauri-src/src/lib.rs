use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

mod commands;
mod providers;
mod services;
mod voice_commands;

use commands::streaming::StreamingState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .manage(StreamingState::default())
        .setup(|app| {
            // Register global shortcuts; on dev reload, ignore "already registered" errors
            let gs = app.global_shortcut();

            // Ctrl+Shift+D -> toggle recording
            let shortcut: Shortcut = "Ctrl+Shift+D".parse().unwrap();
            if let Err(e) = gs.on_shortcut(shortcut, |app, _event, _shortcut| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("toggle-recording", ());
                }
            }) {
                eprintln!("[HOTKEY] Failed to register Ctrl+Shift+D: {}", e);
            }

            // Ctrl+Shift+L -> toggle DevTools
            let debug_shortcut: Shortcut = "Ctrl+Shift+L".parse().unwrap();
            if let Err(e) = gs.on_shortcut(debug_shortcut, |app, _event, _shortcut| {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_devtools_open() {
                        let _ = window.close_devtools();
                    } else {
                        let _ = window.open_devtools();
                    }
                }
            }) {
                eprintln!("[HOTKEY] Failed to register Ctrl+Shift+L: {}", e);
            }

            // Ctrl+Shift+V -> toggle compact view
            let view_shortcut: Shortcut = "Ctrl+Shift+V".parse().unwrap();
            if let Err(e) = gs.on_shortcut(view_shortcut, |app, _event, _shortcut| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("toggle-view", ());
                }
            }) {
                eprintln!("[HOTKEY] Failed to register Ctrl+Shift+V: {}", e);
            }

            // Ctrl+Shift+G -> grammar correction
            let grammar_shortcut: Shortcut = "Ctrl+Shift+G".parse().unwrap();
            if let Err(e) = gs.on_shortcut(grammar_shortcut, |app, _event, _shortcut| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("sparkle-trigger", ());
                }
            }) {
                eprintln!("[HOTKEY] Failed to register Ctrl+Shift+G: {}", e);
            }

            // Ctrl+Shift+S -> toggle settings window
            let settings_shortcut: Shortcut = "Ctrl+Shift+S".parse().unwrap();
            if let Err(e) = gs.on_shortcut(settings_shortcut, |app, _event, _shortcut| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("toggle-settings", ());
                }
            }) {
                eprintln!("[HOTKEY] Failed to register Ctrl+Shift+S: {}", e);
            }

            // Ctrl+Shift+X -> close app gracefully
            let close_shortcut: Shortcut = "Ctrl+Shift+X".parse().unwrap();
            if let Err(e) = gs.on_shortcut(close_shortcut, |app, _event, _shortcut| {
                // Close main window gracefully, which will trigger app exit
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.close();
                }
                // Close settings window if open
                if let Some(settings) = app.get_webview_window("settings") {
                    let _ = settings.close();
                }
            }) {
                eprintln!("[HOTKEY] Failed to register Ctrl+Shift+X: {}", e);
            }

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

            // Restore window size and position based on preferences
            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.app_handle().clone();
                let window_clone = window.clone();
                
                tauri::async_runtime::spawn(async move {
                    if let Ok(settings) = commands::settings::get_settings(app_handle).await {
                        // Restore compact mode
                        if settings.compact_mode {
                            let _ = window_clone.set_size(tauri::Size::Logical(tauri::LogicalSize {
                                width: 60.0,
                                height: 70.0,
                            }));
                        }
                        
                        // Restore window position
                        if let Some(pos) = settings.main_window_position {
                            let _ = window_clone.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                                x: pos.x,
                                y: pos.y,
                            }));
                        } else {
                            // No stored position
                        }
                    }
                    
                    // Show window after positioning (prevents flash)
                    let _ = window_clone.show();
                });
                
                // Debounced position saving (like Electron: 75ms after last move)
                let app_handle_move = app.app_handle().clone();
                let (tx, mut rx) = mpsc::channel::<(i32, i32)>(100);
                
                // Spawn a task to handle debounced saves
                tauri::async_runtime::spawn(async move {
                    while let Some((x, y)) = rx.recv().await {
                        // Wait for 75ms - if another position comes in, this will be cancelled
                        sleep(Duration::from_millis(75)).await;
                        
                        // Drain any pending positions (only save the latest)
                        let mut latest_x = x;
                        let mut latest_y = y;
                        while let Ok((new_x, new_y)) = rx.try_recv() {
                            latest_x = new_x;
                            latest_y = new_y;
                        }
                        
                        let _ = commands::settings::save_window_position(app_handle_move.clone(), latest_x, latest_y).await;
                    }
                });
                
                // Listen for move events
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Moved(position) = event {
                        // Send position to debouncer
                        let _ = tx.try_send((position.x, position.y));
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::transcribe_audio_segment,
            commands::insert_text,
            commands::copy_selected_text,
            commands::correct_grammar,
            commands::get_settings,
            commands::save_settings,
            commands::open_settings_window,
            commands::exit_app,
            commands::toggle_compact_mode,
            commands::save_window_position,
            commands::update_settings_size,
            commands::start_streaming_transcription,
            commands::send_streaming_audio,
            commands::stop_streaming_transcription,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
