"""WinLux Speech Module — ASR and TTS services for Vietnamese.

Provides:
  - Whisper ASR: Speech-to-text with Vietnamese dialect support
  - Edge TTS: Text-to-speech with regional voices (Bắc/Trung/Nam)

Usage:
    from winlux.speech import transcribe, transcribe_file, speak, VoiceRegion
    
    # ASR
    text = await transcribe(audio_bytes)
    text = await transcribe_file("audio.mp3")
    
    # TTS
    audio = await speak("Xin chào", voice=VoiceRegion.NORTHERN)
"""

from winlux.speech.asr import (
    transcribe,
    transcribe_file,
    transcribe_stream,
    ASRResult,
    ASRConfig,
    WhisperASR,
)

from winlux.speech.tts import (
    speak,
    speak_to_file,
    get_available_voices,
    VoiceRegion,
    TTSConfig,
    EdgeTTS,
)

__all__ = [
    # ASR
    "transcribe",
    "transcribe_file",
    "transcribe_stream",
    "ASRResult",
    "ASRConfig",
    "WhisperASR",
    # TTS
    "speak",
    "speak_to_file",
    "get_available_voices",
    "VoiceRegion",
    "TTSConfig",
    "EdgeTTS",
]
