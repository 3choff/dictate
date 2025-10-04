use tauri::{AppHandle, Manager};
use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub groq_api_key: String,
    #[serde(default = "default_prompts")]
    pub prompts: HashMap<String, String>,
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
