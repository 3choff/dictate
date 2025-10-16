// Re-export all command modules
pub mod settings;
pub mod transcription;
pub mod text_rewrite;
pub mod text_injection;
pub mod streaming;

// Re-export commonly used commands
pub use transcription::*;
pub use text_rewrite::*;
pub use text_injection::*;
pub use streaming::*;
pub use settings::*;
