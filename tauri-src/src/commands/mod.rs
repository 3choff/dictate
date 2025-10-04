// Re-export all command modules
pub mod transcription;
pub mod text_injection;
pub mod window;
pub mod settings;

// Re-export commonly used commands
pub use transcription::*;
pub use text_injection::*;
pub use window::*;
pub use settings::*;
