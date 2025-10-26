use tauri::{Emitter, Manager, AppHandle};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

mod commands;
mod providers;
mod services;
mod vad;
mod voice_commands;

use commands::streaming::StreamingState;
use commands::settings::Settings;

pub fn register_shortcuts(app: &AppHandle) {
    // Load settings to get custom shortcuts
    let settings = match commands::settings::get_settings_sync(app) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[HOTKEY] Failed to load settings, using defaults: {}", e);
            Settings::default()
        }
    };

    let gs = app.global_shortcut();
    let shortcuts = &settings.keyboard_shortcuts;
    let push_to_talk = settings.push_to_talk_enabled;

    // Toggle recording (supports both push-to-talk and toggle modes)
    if let Ok(shortcut) = shortcuts.toggle_recording.parse::<Shortcut>() {
        if let Err(e) = gs.on_shortcut(shortcut, move |app, _shortcut, event| {
            if let Some(window) = app.get_webview_window("main") {
                if push_to_talk {
                    // Push-to-talk mode: hold to record, release to stop
                    match event.state {
                        ShortcutState::Pressed => {
                            let _ = window.emit("start-recording", ());
                        }
                        ShortcutState::Released => {
                            let _ = window.emit("stop-recording", ());
                        }
                    }
                } else {
                    // Toggle mode: press once to start/stop
                    if event.state == ShortcutState::Pressed {
                        let _ = window.emit("toggle-recording", ());
                    }
                }
            }
        }) {
            eprintln!("[HOTKEY] Failed to register {}: {}", shortcuts.toggle_recording, e);
        }
    }

    // Toggle debug
    if let Ok(shortcut) = shortcuts.toggle_debug.parse::<Shortcut>() {
        if let Err(e) = gs.on_shortcut(shortcut, |app, _event, _shortcut| {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_devtools_open() {
                    let _ = window.close_devtools();
                } else {
                    let _ = window.open_devtools();
                }
            }
        }) {
            eprintln!("[HOTKEY] Failed to register {}: {}", shortcuts.toggle_debug, e);
        }
    }

    // Toggle view
    if let Ok(shortcut) = shortcuts.toggle_view.parse::<Shortcut>() {
        if let Err(e) = gs.on_shortcut(shortcut, |app, _event, _shortcut| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("toggle-view", ());
            }
        }) {
            eprintln!("[HOTKEY] Failed to register {}: {}", shortcuts.toggle_view, e);
        }
    }

    // Text rewrite
    if let Ok(shortcut) = shortcuts.rewrite.parse::<Shortcut>() {
        if let Err(e) = gs.on_shortcut(shortcut, |app, _event, _shortcut| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("sparkle-trigger", ());
            }
        }) {
            eprintln!("[HOTKEY] Failed to register {}: {}", shortcuts.rewrite, e);
        }
    }

    // Toggle settings
    if let Ok(shortcut) = shortcuts.toggle_settings.parse::<Shortcut>() {
        if let Err(e) = gs.on_shortcut(shortcut, |app, _event, _shortcut| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("toggle-settings", ());
            }
        }) {
            eprintln!("[HOTKEY] Failed to register {}: {}", shortcuts.toggle_settings, e);
        }
    }

    // Close app
    if let Ok(shortcut) = shortcuts.close_app.parse::<Shortcut>() {
        if let Err(e) = gs.on_shortcut(shortcut, |app, _event, _shortcut| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.close();
            }
            if let Some(settings) = app.get_webview_window("settings") {
                let _ = settings.close();
            }
        }) {
            eprintln!("[HOTKEY] Failed to register {}: {}", shortcuts.close_app, e);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .manage(StreamingState::default())
        .manage(commands::settings::ReleaseState::default())
        .setup(|app| {
            // Initialize VAD session manager
            let vad_manager = vad::VadSessionManager::new(app.handle().clone());
            app.manage(vad_manager);
            
            // Register global shortcuts from settings
            register_shortcuts(app.handle());

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
                                width: 175.0,
                                height: 35.0,
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
            commands::rewrite_text,
            commands::get_settings,
            commands::save_settings,
            commands::reregister_shortcuts,
            commands::apply_theme,
            commands::open_settings_window,
            commands::exit_app,
            commands::toggle_compact_mode,
            commands::save_window_position,
            commands::get_app_version,
            commands::get_latest_release_tag,
            commands::update_settings_size,
            commands::start_streaming_transcription,
            commands::send_streaming_audio,
            commands::stop_streaming_transcription,
            commands::vad::vad_create_session,
            commands::vad::vad_push_frame,
            commands::vad::vad_stop_session,
            commands::vad::vad_destroy_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
