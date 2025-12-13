use tauri::{Emitter, Manager, AppHandle};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
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

    // Text rewrite (select-all, then trigger rewrite) on key release to avoid SHIFT still held
    if let Ok(shortcut) = shortcuts.rewrite.parse::<Shortcut>() {
        if let Err(e) = gs.on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Released {
                if let Some(window) = app.get_webview_window("main") {
                    let window_clone = window.clone();
                    tauri::async_runtime::spawn(async move {
                        // Wait a bit for all modifiers from the hotkey to be released
                        sleep(Duration::from_millis(200)).await;
                        // Select all using the same command we expose to the frontend
                        let _ = commands::text_injection::select_all_text(window_clone.app_handle().clone()).await;
                        sleep(Duration::from_millis(150)).await;
                        let _ = window_clone.emit("sparkle-trigger", ());
                    });
                }
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

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use enigo::{Enigo, Settings as EnigoSettings};

struct QuitState(AtomicBool);
pub struct EnigoState(pub Mutex<Enigo>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .manage(StreamingState::default())
        .manage(commands::settings::ReleaseState::default())
        .manage(QuitState(AtomicBool::new(false)))
        .manage(EnigoState(Mutex::new(Enigo::new(&EnigoSettings::default()).expect("Failed to init Enigo"))))
        .setup(|app| {
            // Initialize VAD session manager
            let vad_manager = vad::VadSessionManager::new(app.handle().clone());
            app.manage(vad_manager);
            
            // Register global shortcuts from settings
            register_shortcuts(app.handle());

            // Load settings for language
            let settings = commands::settings::get_settings_sync(app.handle()).unwrap_or_default();
            let lang = settings.app_language.as_str();
            
            let (quit_label, settings_label, show_label) = match lang {
                "it" => ("Esci", "Impostazioni", "Mostra/Nascondi"),
                "es" => ("Salir", "Configuración", "Mostrar/Ocultar"),
                "fr" => ("Quitter", "Paramètres", "Afficher/Masquer"),
                "de" => ("Beenden", "Einstellungen", "Anzeigen/Verbergen"),
                "pt" => ("Sair", "Configurações", "Mostrar/Ocultar"),
                "zh" => ("退出", "设置", "显示/隐藏"),
                "ja" => ("終了", "設定", "表示/非表示"),
                "ru" => ("Выход", "Настройки", "Показать/Скрыть"),
                _ => ("Quit", "Settings", "Show/Hide"),
            };

            // Initialize System Tray
            let quit_i = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", settings_label, true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&show_i, &settings_i, &separator, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Dictate")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        let state = app.state::<QuitState>();
                        state.0.store(true, Ordering::Relaxed);
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.close();
                        }
                        if let Some(w) = app.get_webview_window("settings") {
                            let _ = w.close();
                        }
                        
                        // Force exit after delay to ensure app closes even if windows don't trigger it
                        let app_clone = app.clone();
                        tauri::async_runtime::spawn(async move {
                            sleep(Duration::from_millis(500)).await;
                            app_clone.exit(0);
                        });
                    },
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "settings" => {
                        let app_clone = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = commands::settings::open_settings_window(app_clone).await;
                        });
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

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

            // Configure autostart based on user setting
            {
                let settings = commands::settings::get_settings_sync(&app.handle())
                    .unwrap_or_default();
                let autostart_manager = app.autolaunch();
                if settings.autostart_enabled {
                    let _ = autostart_manager.enable();
                } else {
                    let _ = autostart_manager.disable();
                }
            }

            // Restore window size and position based on preferences
            if let Some(window) = app.get_webview_window("main") {
                let app_handle = app.app_handle().clone();
                let window_clone = window.clone();
                
                tauri::async_runtime::spawn(async move {
                    let mut start_hidden = false;
                    if let Ok(settings) = commands::settings::get_settings(app_handle).await {
                        start_hidden = settings.start_hidden;
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
                    
                    // Show window after positioning (prevents flash) if not starting hidden
                    if !start_hidden {
                        let _ = window_clone.show();
                    }
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
                
                // Listen for events
                let window_ref = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Moved(position) => {
                            // Send position to debouncer
                            let _ = tx.try_send((position.x, position.y));
                        }
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            let app_handle = window_ref.app_handle();
                            
                            // Check global quit state
                            let quit_state = app_handle.state::<QuitState>();
                            if quit_state.0.load(Ordering::Relaxed) {
                                return; // Allow close
                            }
                            
                            let settings_result = commands::settings::get_settings_sync(app_handle);
                            
                            match settings_result {
                                Ok(settings) => {
                                    if settings.close_to_tray {
                                        api.prevent_close();
                                        let _ = window_ref.hide();
                                    }
                                }
                                Err(_) => {
                                    // Default to safe behavior (hide) if settings fail
                                    api.prevent_close();
                                    let _ = window_ref.hide();
                                }
                            }
                        }
                        _ => {}
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::transcribe_audio_segment,
            commands::insert_text,
            commands::select_all_text,
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
            commands::set_autostart_enabled,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
