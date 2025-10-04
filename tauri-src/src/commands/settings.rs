use tauri::{AppHandle, Manager};
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub groq_api_key: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            groq_api_key: String::new(),
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
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    // Check if settings window already exists
    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
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
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
