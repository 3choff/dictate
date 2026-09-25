// Batch providers (HTTP-based)
pub mod groq;
pub mod sambanova;
pub mod fireworks;
pub mod gemini;
pub mod mistral;
pub mod inception;
pub mod crisperwhisper;

// Streaming providers (WebSocket-based)
pub mod deepgram;
pub mod cartesia;
pub mod voxtral;
pub mod elevenlabs;
pub mod gemini_live;

// Text-to-speech providers (HTTP-based)
pub mod tts_sixtydb;
pub mod tts_elevenlabs;
