use tauri::{Emitter, Manager, AppHandle};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use serde_json::json;
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

pub struct QuitState(pub AtomicBool);
pub struct EnigoState(pub Mutex<Enigo>);

fn tray_labels(lang: &str) -> (&'static str, &'static str, &'static str) {
    match lang {
        "it" => ("Esci", "Impostazioni", "Mostra/Nascondi"),
        "es" => ("Salir", "Configuración", "Mostrar/Ocultar"),
        "fr" => ("Quitter", "Paramètres", "Afficher/Masquer"),
        "de" => ("Beenden", "Einstellungen", "Anzeigen/Verbergen"),
        "nl" => ("Afsluiten", "Instellingen", "Weergeven/Verbergen"),
        "pt" => ("Sair", "Configurações", "Mostrar/Ocultar"),
        "zh" => ("退出", "设置", "显示/隐藏"),
        "ja" => ("終了", "設定", "表示/非表示"),
        "ru" => ("Выход", "Настройки", "Показать/Скрыть"),
        _ => ("Quit", "Settings", "Show/Hide"),
    }
}

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
        .manage(commands::settings::TrayMenuAnchorState(Mutex::new(None)))
        .manage(commands::settings::TrayMenuSizeState(Mutex::new(None)))
        .setup(|app| {
            // Initialize VAD session manager
            let vad_manager = vad::VadSessionManager::new(app.handle().clone());
            app.manage(vad_manager);
            
            // Register global shortcuts from settings
            register_shortcuts(app.handle());

            // Pre-create tray menu window (hidden) so it's ready for first right-click
            let tray_menu_builder = tauri::WebviewWindowBuilder::new(
                app,
                "tray_menu",
                tauri::WebviewUrl::App("../tray-menu/index.html".into()),
            )
            .title("Tray Menu")
            .inner_size(200.0, 170.0)
            .resizable(false)
            .decorations(false)
            .shadow(false)
            .transparent(true)
            .visible(false)
            .skip_taskbar(true)
            .always_on_top(true)
            .focusable(true);

            if let Ok(tray_menu_wnd) = tray_menu_builder.build() {
                let ever_focused = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
                let w_ref = tray_menu_wnd.clone();
                let ever_focused_ref = ever_focused.clone();
                tray_menu_wnd.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Focused(true) => {
                            ever_focused_ref.store(true, Ordering::Relaxed);
                        }
                        tauri::WindowEvent::Focused(false) => {
                            if ever_focused_ref.load(Ordering::Relaxed) {
                                let _ = w_ref.hide();
                            }
                        }
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            api.prevent_close();
                            let _ = w_ref.hide();
                        }
                        _ => {}
                    }
                });
            }

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Dictate")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
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
                        TrayIconEvent::Click {
                            button: MouseButton::Right,
                            button_state: MouseButtonState::Up,
                            position,
                            rect: _,
                            ..
                        } => {
                            let app = tray.app_handle();

                            let settings = commands::settings::get_settings_sync(app).unwrap_or_default();
                            let theme = if settings.dark_mode_enabled { "dark" } else { "light" };
                            let (quit_label, settings_label, show_label) = tray_labels(settings.app_language.as_str());
                            let labels = json!({
                                "quit": quit_label,
                                "settings": settings_label,
                                "show": show_label
                            });

                            // Get pre-created tray menu window
                            let Some(tray_menu_wnd) = app.get_webview_window("tray_menu") else {
                                return;
                            };

                            let _ = tray_menu_wnd.eval(&format!(
                                "document.documentElement.setAttribute('data-theme', '{}');",
                                theme
                            ));

                            let _ = tray_menu_wnd.eval(&format!(
                                "window.__TRAY_LABELS__ = {}; if (window.__applyTrayLabels__) window.__applyTrayLabels__();",
                                labels.to_string()
                            ));

                            if tray_menu_wnd.is_visible().unwrap_or(false) {
                                let _ = tray_menu_wnd.hide();
                                return;
                            }

                            let scale = tray_menu_wnd.scale_factor().unwrap_or(1.0);
                            let gap_px = 2.0 * scale;

                            let (menu_w_px, menu_h_px) = if let Ok(size_guard) =
                                app.state::<commands::settings::TrayMenuSizeState>().0.lock()
                            {
                                if let Some((w, h)) = *size_guard {
                                    let _ = tray_menu_wnd
                                        .set_size(tauri::Size::Logical(tauri::LogicalSize { width: w, height: h }));
                                    (w * scale, h * scale)
                                } else {
                                    let current_size = tray_menu_wnd.inner_size().ok();
                                    (
                                        current_size.as_ref().map(|s| s.width as f64).unwrap_or(200.0 * scale),
                                        current_size.as_ref().map(|s| s.height as f64).unwrap_or(170.0 * scale),
                                    )
                                }
                            } else {
                                let current_size = tray_menu_wnd.inner_size().ok();
                                (
                                    current_size.as_ref().map(|s| s.width as f64).unwrap_or(200.0 * scale),
                                    current_size.as_ref().map(|s| s.height as f64).unwrap_or(170.0 * scale),
                                )
                            };

                            let anchor_x = position.x;
                            let anchor_y = position.y;

                            let (work_left, work_top, work_right, work_bottom) = {
                                #[cfg(target_os = "windows")]
                                {
                                    services::windows_focus::get_work_area_for_point(
                                        anchor_x as i32,
                                        anchor_y as i32,
                                    )
                                    .unwrap_or((0, 0, i32::MAX, i32::MAX))
                                }
                                #[cfg(not(target_os = "windows"))]
                                {
                                    (0, 0, i32::MAX, i32::MAX)
                                }
                            };

                            if let Ok(mut anchor_guard) =
                                app.state::<commands::settings::TrayMenuAnchorState>().0.lock()
                            {
                                *anchor_guard = Some(commands::settings::TrayMenuAnchor {
                                    anchor_x,
                                    anchor_y_top: anchor_y,
                                    anchor_y_bottom: anchor_y,
                                    work_left,
                                    work_top,
                                    work_right,
                                    work_bottom,
                                });
                            }

                            let min_x = work_left as f64;
                            let min_y = work_top as f64;
                            let max_x = (work_right as f64) - menu_w_px;
                            let max_y = (work_bottom as f64) - menu_h_px;

                            let clamp = |value: f64, min: f64, max: f64| -> f64 {
                                if max < min {
                                    return min;
                                }
                                value.max(min).min(max)
                            };

                            let mut x = clamp(anchor_x - (menu_w_px / 2.0), min_x, max_x);
                            let y_below = anchor_y + gap_px;
                            let y_above = anchor_y - menu_h_px - gap_px;
                            let mut y = if y_below + menu_h_px <= work_bottom as f64 {
                                y_below
                            } else if y_above >= min_y {
                                y_above
                            } else {
                                clamp(anchor_y - (menu_h_px / 2.0), min_y, max_y)
                            };

                            x = clamp(x, min_x, max_x);
                            y = clamp(y, min_y, max_y);

                            let _ = tray_menu_wnd.set_position(tauri::Position::Physical(
                                tauri::PhysicalPosition { x: x as i32, y: y as i32 },
                            ));
                            let _ = tray_menu_wnd.show();
                            {
                                let wnd = tray_menu_wnd.clone();
                                tauri::async_runtime::spawn(async move {
                                    sleep(Duration::from_millis(10)).await;
                                    let _ = wnd.set_focus();
                                });
                            }

                            #[cfg(target_os = "windows")]
                            {
                                let wnd = tray_menu_wnd.clone();
                                tauri::async_runtime::spawn(async move {
                                    use windows::Win32::Foundation::POINT;
                                    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
                                    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

                                    loop {
                                        sleep(Duration::from_millis(25)).await;

                                        if !wnd.is_visible().unwrap_or(false) {
                                            break;
                                        }

                                        unsafe {
                                            let mut pt = POINT { x: 0, y: 0 };
                                            if GetCursorPos(&mut pt).is_err() {
                                                continue;
                                            }

                                            let l = GetAsyncKeyState(0x01);
                                            let r = GetAsyncKeyState(0x02);
                                            let is_down = ((l as u16) & 0x8000) != 0
                                                || ((r as u16) & 0x8000) != 0;
                                            if !is_down {
                                                continue;
                                            }

                                            if let (Ok(pos), Ok(size)) = (wnd.outer_position(), wnd.outer_size()) {
                                                let left = pos.x;
                                                let top = pos.y;
                                                let right = left + size.width as i32;
                                                let bottom = top + size.height as i32;

                                                let inside = pt.x >= left
                                                    && pt.x <= right
                                                    && pt.y >= top
                                                    && pt.y <= bottom;
                                                if !inside {
                                                    let _ = wnd.hide();
                                                    break;
                                                }
                                            } else {
                                                let _ = wnd.hide();
                                                break;
                                            }
                                        }
                                    }
                                });
                            }
                        }
                        _ => {}
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
                                return;
                            }
                            
                            let settings_result = commands::settings::get_settings_sync(app_handle);
                            
                            match settings_result {
                                Ok(settings) => {
                                    if settings.close_to_tray {
                                        api.prevent_close();
                                        let _ = window_ref.hide();
                                    } else {
                                        // Close to tray is OFF - exit the app completely
                                        app_handle.exit(0);
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
            commands::tray_menu_ready,
            commands::toggle_main_window,
            commands::toggle_compact_mode,
            commands::emit_toggle_view,
            commands::save_window_position,
            commands::get_app_version,
            commands::get_latest_release_tag,
            commands::update_settings_size,
            commands::update_tray_menu_size,
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
