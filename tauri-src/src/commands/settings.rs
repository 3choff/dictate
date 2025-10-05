use tauri::{AppHandle, Manager, Emitter};
use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub groq_api_key: String,
    #[serde(default = "default_prompts")]
    pub prompts: HashMap<String, String>,
    #[serde(default)]
    pub compact_mode: bool,
    #[serde(default = "default_insertion_mode")]
    pub insertion_mode: String,
    #[serde(default)]
    pub main_window_position: Option<WindowPosition>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

fn default_insertion_mode() -> String {
    "typing".to_string()
}

fn default_prompts() -> HashMap<String, String> {
    let mut prompts = HashMap::new();
    prompts.insert(
        "grammar_correction".to_string(),
        "Correct the grammar and spelling of the following text. Return only the corrected text without any explanations or additional commentary.".to_string()
    );
    prompts
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            groq_api_key: String::new(),
            prompts: default_prompts(),
            compact_mode: false,
            insertion_mode: default_insertion_mode(),
            main_window_position: None,
        }
    }
}

fn get_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
        .and_then(|path| {
            fs::create_dir_all(&path).map_err(|e| e.to_string())?;
            Ok(path.join("settings.json"))
        })
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let settings_path = get_settings_path(&app)?;
    
    if !settings_path.exists() {
        return Ok(Settings::default());
    }
    
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| e.to_string())?;
    
    serde_json::from_str(&content)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let settings_path = get_settings_path(&app)?;
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| e.to_string())?;
    
    fs::write(&settings_path, content)
        .map_err(|e| e.to_string())?;
    
    // Emit event to notify main window that settings changed
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.emit("settings-changed", ());
    }
    
    Ok(())
}

#[tauri::command]
pub async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    // Settings window size
    const SETTINGS_WIDTH: f64 = 300.0;
    const SETTINGS_HEIGHT: f64 = 300.0;
    const GAP: f64 = 10.0;
    
    // If settings window already exists, toggle visibility without destroying it
    if let Some(window) = app.get_webview_window("settings") {
        // If currently visible, hide it (toggle off)
        if window.is_visible().map_err(|e| e.to_string())? {
            window.hide().map_err(|e| e.to_string())?;
            return Ok(());
        }

        // Window exists but is hidden: run measurement script and let update_settings_size position and show it
        let _ = window.eval(r#"
            (function(){
              const send = () => {
                const r = document.body.getBoundingClientRect();
                const payload = { width: Math.ceil(r.width), height: Math.ceil(r.height) };
                try {
                  if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
                    window.__TAURI__.core.invoke('update_settings_size', payload);
                  }
                } catch (e) {}
              };
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(send), { once: true });
              } else {
                requestAnimationFrame(send);
              }
            })();
        "#);
        return Ok(());
    }
    
    // Get main window position and size
    let main_window = app.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let main_pos = main_window.outer_position().map_err(|e| e.to_string())?;
    let main_size = main_window.outer_size().map_err(|e| e.to_string())?;
    
    // Get monitor and work area
    let monitor = main_window.current_monitor().map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;
    let work_area = monitor.size();
    let monitor_pos = monitor.position();
    let scale_factor = monitor.scale_factor();
    
    // Calculate work area bounds
    let work_x = monitor_pos.x as f64;
    let work_y = monitor_pos.y as f64;
    let work_width = work_area.width as f64;
    let work_height = work_area.height as f64;
    let work_right = work_x + work_width;
    let work_bottom = work_y + work_height;
    
    // Main window bounds
    let main_x = main_pos.x as f64;
    let main_y = main_pos.y as f64;
    let main_width = main_size.width as f64;
    let main_height = main_size.height as f64;

    // Convert logical sizes to physical pixels using monitor scale factor
    let settings_width_px = SETTINGS_WIDTH * scale_factor;
    let settings_height_px = SETTINGS_HEIGHT * scale_factor;
    let gap_px = GAP * scale_factor;
    
    // Try positions in order of preference: Left, Right, Below, Above
    let position = calculate_settings_position(
        main_x, main_y, main_width, main_height,
        settings_width_px, settings_height_px,
        work_x, work_y, work_right, work_bottom,
        gap_px
    );

    // Create new settings window at calculated position (always fresh, like Electron)
    let settings_window = tauri::WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("../settings/index.html".into())
    )
    .title("Settings")
    .inner_size(SETTINGS_WIDTH, SETTINGS_HEIGHT)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .visible(false)  // Hide initially like Electron
    .skip_taskbar(true)
    .always_on_top(true)
    .build()
    .map_err(|e| e.to_string())?;
    // Set position explicitly after creation (more reliable)
    settings_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x: position.0 as i32,
        y: position.1 as i32,
    })).map_err(|e| e.to_string())?;

    // Inject JS into the settings webview to measure content size and invoke Rust command
    let _ = settings_window.eval(r#"
        (function(){
          const send = () => {
            const r = document.body.getBoundingClientRect();
            const payload = { width: Math.ceil(r.width), height: Math.ceil(r.height) };
            try {
              if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
                window.__TAURI__.core.invoke('update_settings_size', payload);
              }
            } catch (e) {}
          };
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(send), { once: true });
          } else {
            requestAnimationFrame(send);
          }
          try {
            const ro = new ResizeObserver(() => requestAnimationFrame(send));
            ro.observe(document.body);
          } catch (e) {}
        })();
    "#);

    Ok(())
}

fn calculate_settings_position(
    main_x: f64, main_y: f64, main_width: f64, main_height: f64,
    settings_width: f64, settings_height: f64,
    work_x: f64, work_y: f64, work_right: f64, work_bottom: f64,
    gap: f64
) -> (f64, f64) {
    let min_x = work_x + gap;
    let max_x = work_right - settings_width - gap;
    let min_y = work_y + gap;
    let max_y = work_bottom - settings_height - gap;
    
    // Helper to clamp values
    let clamp = |value: f64, min: f64, max: f64| -> f64 {
        if max < min { return min; }
        value.max(min).min(max)
    };
    
    // Try left of main window (preferred)
    let left_x = main_x - settings_width - gap;
    // Check both left edge AND right edge fit on screen
    if left_x >= min_x {
        let y = clamp(main_y, min_y, max_y);
        return (left_x, y);
    }
    
    // Try right of main window
    let mut right_x = main_x + main_width + gap;
    // Compensate for OS/window visual shadow so the perceived gap matches LEFT
    let shadow_comp = gap.max(1.0); // cap compensation to avoid overshooting
    right_x -= shadow_comp;
    // Check both left edge AND right edge fit on screen
    if right_x <= max_x {
        let y = clamp(main_y, min_y, max_y);
        return (right_x, y);
    }
    
    // Try below main window
    let mut below_y = main_y + main_height + gap;
    // Compensate for OS/window visual shadow similar to RIGHT case
    below_y -= shadow_comp;
    // Check both top edge AND bottom edge fit on screen
    if below_y <= max_y {
        let x = clamp(main_x, min_x, max_x);
        let y = clamp(below_y, min_y, max_y);
        return (x, y);
    }
    
    // Try above main window
    let above_y = main_y - settings_height - gap;
    // Check both top edge AND bottom edge fit on screen
    if above_y >= min_y {
        let x = clamp(main_x, min_x, max_x);
        let y = clamp(above_y, min_y, max_y);
        return (x, y);
    }
    
    // Fallback: clamp to work area (ensure fully visible)
    let fallback_x = clamp(main_x, min_x, max_x);
    let fallback_y = clamp(main_y, min_y, max_y);
    (fallback_x, fallback_y)
}

#[tauri::command]
pub async fn exit_app(_app: AppHandle) {
    std::process::exit(0);
}

#[tauri::command]
pub async fn update_settings_size(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    // Safety: if settings window is gone, nothing to do
    let Some(settings_wnd) = app.get_webview_window("settings") else { return Ok(()); };

    // Get main window + monitor for positioning math
    let main_window = app.get_webview_window("main").ok_or("Main window not found")?;
    let main_pos = main_window.outer_position().map_err(|e| e.to_string())?;
    let main_size = main_window.outer_size().map_err(|e| e.to_string())?;
    let monitor = main_window.current_monitor().map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;

    // Work area bounds (physical pixels)
    let work_area = monitor.size();
    let monitor_pos = monitor.position();
    let work_x = monitor_pos.x as f64;
    let work_y = monitor_pos.y as f64;
    let work_right = work_x + work_area.width as f64;
    let work_bottom = work_y + work_area.height as f64;

    // Main window bounds (physical)
    let main_x = main_pos.x as f64;
    let main_y = main_pos.y as f64;
    let main_width = main_size.width as f64;
    let main_height = main_size.height as f64;

    // Convert logical -> physical for positioning math
    let scale = monitor.scale_factor();
    let settings_w_px = width * scale;
    let settings_h_px = height * scale;

    // Use same GAP as open_settings_window (10 logical -> scaled)
    let gap_px = 10.0 * scale;

    // Compute new placement
    let (new_x, new_y) = calculate_settings_position(
        main_x, main_y, main_width, main_height,
        settings_w_px, settings_h_px,
        work_x, work_y, work_right, work_bottom,
        gap_px,
    );

    // Apply content size (logical) and move (physical)
    settings_wnd
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| e.to_string())?;
    settings_wnd
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: new_x as i32,
            y: new_y as i32,
        }))
        .map_err(|e| e.to_string())?;

    // Show (and focus) the window once we have applied the real size
    if !settings_wnd.is_visible().map_err(|e| e.to_string())? {
        settings_wnd.show().map_err(|e| e.to_string())?;
        let _ = settings_wnd.set_focus();
    }

    Ok(())
}

const DEFAULT_MAIN_WINDOW_WIDTH: f64 = 145.0;
const DEFAULT_MAIN_WINDOW_HEIGHT: f64 = 90.0;
const COMPACT_MAIN_WINDOW_WIDTH: f64 = 60.0;
const COMPACT_MAIN_WINDOW_HEIGHT: f64 = 70.0;

#[tauri::command]
pub async fn toggle_compact_mode(app: AppHandle, enabled: bool) -> Result<(), String> {
    // println!("[COMPACT] Toggle called with enabled={}", enabled);
    
    // Get main window
    let main_window = app.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    // Load current settings
    let mut settings = get_settings(app.clone()).await?;
    
    // println!("[COMPACT] Current settings.compact_mode={}", settings.compact_mode);
    
    // Only proceed if state is actually changing
    if settings.compact_mode == enabled {
        // println!("[COMPACT] No change needed, already in target state");
        return Ok(());
    }
    
    // Simple fixed size toggle - like Electron
    if enabled {
        // println!("[COMPACT] Setting compact size: {}x{}", COMPACT_MAIN_WINDOW_WIDTH, COMPACT_MAIN_WINDOW_HEIGHT);
        main_window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: COMPACT_MAIN_WINDOW_WIDTH,
            height: COMPACT_MAIN_WINDOW_HEIGHT,
        })).map_err(|e| e.to_string())?;
    } else {
        // println!("[COMPACT] Setting normal size: {}x{}", DEFAULT_MAIN_WINDOW_WIDTH, DEFAULT_MAIN_WINDOW_HEIGHT);
        main_window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: DEFAULT_MAIN_WINDOW_WIDTH,
            height: DEFAULT_MAIN_WINDOW_HEIGHT,
        })).map_err(|e| e.to_string())?;
    }
    
    // Save compact mode preference
    settings.compact_mode = enabled;
    save_settings(app, settings).await?;
    
    // println!("[COMPACT] Toggle complete, saved settings");
    
    Ok(())
}

#[tauri::command]
pub async fn save_window_position(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    let mut settings = get_settings(app.clone()).await?;
    settings.main_window_position = Some(WindowPosition { x, y });
    save_settings(app, settings).await
}
