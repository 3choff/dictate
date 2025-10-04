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
    // Check if settings window already exists
    if let Some(window) = app.get_webview_window("settings") {
        // Toggle visibility
        if window.is_visible().map_err(|e| e.to_string())? {
            window.hide().map_err(|e| e.to_string())?;
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // Create new settings window
    tauri::WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("../settings/index.html".into())
    )
    .title("Settings")
    .inner_size(400.0, 300.0)
    .resizable(false)
    .center()
    .decorations(false)
    .transparent(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn exit_app(_app: AppHandle) {
    std::process::exit(0);
}

const DEFAULT_MAIN_WINDOW_WIDTH: f64 = 145.0;
const DEFAULT_MAIN_WINDOW_HEIGHT: f64 = 90.0;
const COMPACT_MAIN_WINDOW_WIDTH: f64 = 65.0;
const COMPACT_MAIN_WINDOW_HEIGHT: f64 = 75.0;

#[tauri::command]
pub async fn toggle_compact_mode(app: AppHandle, enabled: bool) -> Result<(), String> {
    println!("[COMPACT] Toggle called with enabled={}", enabled);
    
    // Get main window
    let main_window = app.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    // Load current settings
    let mut settings = get_settings(app.clone()).await?;
    
    println!("[COMPACT] Current settings.compact_mode={}", settings.compact_mode);
    
    // Only proceed if state is actually changing
    if settings.compact_mode == enabled {
        println!("[COMPACT] No change needed, already in target state");
        return Ok(());
    }
    
    // Simple fixed size toggle - like Electron
    if enabled {
        println!("[COMPACT] Setting compact size: {}x{}", COMPACT_MAIN_WINDOW_WIDTH, COMPACT_MAIN_WINDOW_HEIGHT);
        main_window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: COMPACT_MAIN_WINDOW_WIDTH,
            height: COMPACT_MAIN_WINDOW_HEIGHT,
        })).map_err(|e| e.to_string())?;
    } else {
        println!("[COMPACT] Setting normal size: {}x{}", DEFAULT_MAIN_WINDOW_WIDTH, DEFAULT_MAIN_WINDOW_HEIGHT);
        main_window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: DEFAULT_MAIN_WINDOW_WIDTH,
            height: DEFAULT_MAIN_WINDOW_HEIGHT,
        })).map_err(|e| e.to_string())?;
    }
    
    // Save compact mode preference
    settings.compact_mode = enabled;
    save_settings(app, settings).await?;
    
    println!("[COMPACT] Toggle complete, saved settings");
    
    Ok(())
}
