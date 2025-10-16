use crate::audio_analyzer::AudioAnalyzer;
use serde::Serialize;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::{mpsc, Mutex, RwLock};

const SAMPLE_RATE: u32 = 48000;
const WINDOW_SIZE: usize = 512; // Smaller window for faster response (from Handy project)

#[derive(Clone, Serialize)]
pub struct AudioBarsData {
    pub bars: [f32; 9],
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<i64>,
}

/// Manages the audio visualization in a background thread
pub struct VisualizerManager {
    audio_tx: Arc<RwLock<Option<mpsc::UnboundedSender<Vec<f32>>>>>,
    reset_tx: Arc<RwLock<Option<mpsc::UnboundedSender<()>>>>,
    is_active: Arc<Mutex<bool>>,
    app_handle: tauri::AppHandle,
}

impl VisualizerManager {
    /// Create a new visualizer manager
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self { 
            audio_tx: Arc::new(RwLock::new(None)),
            reset_tx: Arc::new(RwLock::new(None)),
            is_active: Arc::new(Mutex::new(false)),
            app_handle,
        }
    }

    /// Send audio chunk for analysis (non-blocking)
    /// This should be called for EVERY audio chunk received from the microphone
    pub async fn send_audio_chunk(&self, samples: Vec<f32>) {
        let is_active = *self.is_active.lock().await;
        if !is_active {
            return; // Don't process audio if not active
        }
        
        if let Some(tx) = self.audio_tx.read().await.as_ref() {
            if let Err(e) = tx.send(samples) {
                eprintln!("[VisualizerManager] Failed to send audio chunk: {}", e);
            }
        } else {
            eprintln!("[VisualizerManager] Warning: No audio channel available (task not started?)");
        }
    }

    /// Start the visualizer (begin sending updates to frontend)
    pub async fn start(&self) {
        // Spawn background task if not already spawned
        {
            let tx_guard = self.audio_tx.read().await;
            if tx_guard.is_none() {
                drop(tx_guard); // Release read lock
                
                let (audio_tx, mut audio_rx) = mpsc::unbounded_channel::<Vec<f32>>();
                let (reset_tx, mut reset_rx) = mpsc::unbounded_channel::<()>();
                let app_handle = self.app_handle.clone();

                // Spawn background analyzer thread
                tokio::spawn(async move {
                    println!("[VisualizerManager] Background analyzer task spawned");
                    let mut analyzer = AudioAnalyzer::new(SAMPLE_RATE, WINDOW_SIZE);

                    loop {
                        tokio::select! {
                            // Receive new audio samples - process immediately like Handy
                            Some(samples) = audio_rx.recv() => {
                                // Feed samples to analyzer (it buffers internally)
                                if let Some(buckets) = analyzer.feed(&samples) {
                                    // Only emit when we have a full window processed
                                    let data = AudioBarsData {
                                        bars: buckets,
                                        timestamp: Some(chrono::Utc::now().timestamp_millis()),
                                    };
                                    
                                    if let Err(e) = app_handle.emit("audio-bars-update", &data) {
                                        eprintln!("[VisualizerManager] Failed to emit bars: {}", e);
                                    }
                                }
                                // If None, not enough samples yet - keep buffering
                            }
                            
                            // Receive reset signal
                            Some(_) = reset_rx.recv() => {
                                analyzer.reset();
                            }
                        }
                    }
                });
                
                // Store the senders
                *self.audio_tx.write().await = Some(audio_tx);
                *self.reset_tx.write().await = Some(reset_tx);
            }
        }
        
        // Reset the analyzer before starting
        if let Some(tx) = self.reset_tx.read().await.as_ref() {
            let _ = tx.send(());
        }
        
        *self.is_active.lock().await = true;
        println!("[VisualizerManager] Started");
    }

    /// Stop the visualizer (stop sending updates to frontend)
    pub async fn stop(&self) {
        *self.is_active.lock().await = false;
        
        // Send zero bars to reset the visualization
        let zero_data = AudioBarsData {
            bars: [0.0; 9],
            timestamp: None,
        };
        
        if let Err(e) = self.app_handle.emit("audio-bars-update", &zero_data) {
            eprintln!("[VisualizerManager] Failed to emit zero bars on stop: {}", e);
        }
        
        println!("[VisualizerManager] Stopped");
    }

}

impl Clone for VisualizerManager {
    fn clone(&self) -> Self {
        Self {
            audio_tx: Arc::clone(&self.audio_tx),
            reset_tx: Arc::clone(&self.reset_tx),
            is_active: Arc::clone(&self.is_active),
            app_handle: self.app_handle.clone(),
        }
    }
}
