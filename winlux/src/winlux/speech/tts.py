"""
Edge TTS Service — Vietnamese Text-to-Speech
─────────────────────────────────────────────
Regional voice support for Bắc/Trung/Nam dialects.

Features:
  - Microsoft Edge TTS (free, high quality)
  - Regional Vietnamese voices
  - SSML support for emphasis and pauses
  - Streaming audio output
  - Rate/pitch/volume control
"""

import asyncio
import io
import logging
import os
import tempfile
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import AsyncIterator

logger = logging.getLogger("winlux.speech.tts")

try:
    import edge_tts
    _HAS_EDGE_TTS = True
except ImportError:
    _HAS_EDGE_TTS = False
    edge_tts = None


class VoiceRegion(Enum):
    """Vietnamese regional voice options."""

    NORTHERN = "northern"  # Giọng Bắc
    CENTRAL = "central"    # Giọng Trung
    SOUTHERN = "southern"  # Giọng Nam


# Edge TTS Vietnamese voices
VN_VOICES = {
    VoiceRegion.NORTHERN: {
        "male": "vi-VN-NamMinhNeural",
        "female": "vi-VN-HoaiMyNeural",
    },
    VoiceRegion.CENTRAL: {
        "male": "vi-VN-NamMinhNeural",  # Edge TTS doesn't have specific Central voice
        "female": "vi-VN-HoaiMyNeural",
    },
    VoiceRegion.SOUTHERN: {
        "male": "vi-VN-NamMinhNeural",
        "female": "vi-VN-HoaiMyNeural",
    },
}

# All available Vietnamese voices
ALL_VN_VOICES = [
    "vi-VN-HoaiMyNeural",   # Female, Northern
    "vi-VN-NamMinhNeural",  # Male, Northern
]


@dataclass
class TTSConfig:
    """TTS configuration."""

    region: VoiceRegion = VoiceRegion.NORTHERN
    gender: str = "female"  # "male" or "female"
    
    # Voice settings
    rate: str = "+0%"      # Speed: "-50%" to "+100%"
    pitch: str = "+0Hz"    # Pitch: "-50Hz" to "+50Hz"
    volume: str = "+0%"    # Volume: "-50%" to "+50%"
    
    # Output format
    output_format: str = "audio-24khz-48kbitrate-mono-mp3"


@dataclass
class TTSResult:
    """TTS result."""

    audio: bytes
    duration_s: float
    voice: str
    text_length: int


class EdgeTTS:
    """Edge TTS service for Vietnamese text-to-speech."""
    
    def __init__(self, config: TTSConfig | None = None):
        if not _HAS_EDGE_TTS:
            raise ImportError("edge-tts package required. Install with: pip install edge-tts")
        
        self.config = config or TTSConfig()
    
    def _get_voice(self) -> str:
        """Get voice name based on config."""
        voices = VN_VOICES.get(self.config.region, VN_VOICES[VoiceRegion.NORTHERN])
        return voices.get(self.config.gender, voices["female"])
    
    async def speak(self, text: str) -> TTSResult:
        """Convert text to speech.
        
        Args:
            text: Vietnamese text to speak.
        
        Returns:
            TTSResult with audio bytes.
        """
        voice = self._get_voice()
        
        communicate = edge_tts.Communicate(
            text,
            voice,
            rate=self.config.rate,
            pitch=self.config.pitch,
            volume=self.config.volume,
        )
        
        audio_buffer = io.BytesIO()
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])
        
        audio_bytes = audio_buffer.getvalue()
        
        # Estimate duration (rough: 150 words per minute for Vietnamese)
        word_count = len(text.split())
        duration_s = word_count / 2.5  # ~2.5 words per second
        
        return TTSResult(
            audio=audio_bytes,
            duration_s=duration_s,
            voice=voice,
            text_length=len(text),
        )
    
    async def speak_to_file(self, text: str, path: str | Path) -> TTSResult:
        """Convert text to speech and save to file.
        
        Args:
            text: Vietnamese text to speak.
            path: Output file path.
        
        Returns:
            TTSResult with audio info.
        """
        result = await self.speak(text)
        
        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(result.audio)
        
        return result
    
    async def speak_stream(self, text: str) -> AsyncIterator[bytes]:
        """Stream audio chunks as they are generated.
        
        Args:
            text: Vietnamese text to speak.
        
        Yields:
            Audio chunks as bytes.
        """
        voice = self._get_voice()
        
        communicate = edge_tts.Communicate(
            text,
            voice,
            rate=self.config.rate,
            pitch=self.config.pitch,
            volume=self.config.volume,
        )
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]
    
    async def speak_ssml(self, ssml: str) -> TTSResult:
        """Convert SSML to speech.
        
        Args:
            ssml: SSML-formatted text.
        
        Returns:
            TTSResult with audio bytes.
        
        Example SSML:
            <speak>
                <prosody rate="slow">Xin chào!</prosody>
                <break time="500ms"/>
                Tôi là <emphasis level="strong">trợ lý AI</emphasis>.
            </speak>
        """
        voice = self._get_voice()
        
        # Wrap in speak tags if not already
        if not ssml.strip().startswith("<speak"):
            ssml = f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="vi-VN">{ssml}</speak>'
        
        communicate = edge_tts.Communicate(ssml, voice)
        
        audio_buffer = io.BytesIO()
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.write(chunk["data"])
        
        return TTSResult(
            audio=audio_buffer.getvalue(),
            duration_s=0.0,  # Can't estimate for SSML
            voice=voice,
            text_length=len(ssml),
        )


# ═══════════════════════════════════════════════════════════════════════════════
#  Module-level convenience functions
# ═══════════════════════════════════════════════════════════════════════════════

_default_tts: EdgeTTS | None = None


def _get_tts(config: TTSConfig | None = None) -> EdgeTTS:
    """Get or create default TTS instance."""
    global _default_tts
    if config is not None:
        return EdgeTTS(config)
    if _default_tts is None:
        _default_tts = EdgeTTS()
    return _default_tts


async def speak(
    text: str,
    voice: VoiceRegion = VoiceRegion.NORTHERN,
    gender: str = "female",
    config: TTSConfig | None = None,
) -> bytes:
    """Convert Vietnamese text to speech.
    
    Args:
        text: Vietnamese text to speak.
        voice: Regional voice (NORTHERN, CENTRAL, SOUTHERN).
        gender: "male" or "female".
        config: Optional full TTS configuration.
    
    Returns:
        Audio bytes (MP3 format).
    
    Example:
        >>> audio = await speak("Xin chào", voice=VoiceRegion.SOUTHERN)
        >>> with open("output.mp3", "wb") as f:
        ...     f.write(audio)
    """
    if config is None:
        config = TTSConfig(region=voice, gender=gender)
    
    tts = _get_tts(config)
    result = await tts.speak(text)
    return result.audio


async def speak_to_file(
    text: str,
    path: str | Path,
    voice: VoiceRegion = VoiceRegion.NORTHERN,
    gender: str = "female",
    config: TTSConfig | None = None,
) -> TTSResult:
    """Convert Vietnamese text to speech and save to file.
    
    Args:
        text: Vietnamese text to speak.
        path: Output file path.
        voice: Regional voice.
        gender: "male" or "female".
        config: Optional full TTS configuration.
    
    Returns:
        TTSResult with audio info.
    """
    if config is None:
        config = TTSConfig(region=voice, gender=gender)
    
    tts = _get_tts(config)
    return await tts.speak_to_file(text, path)


async def get_available_voices() -> list[dict]:
    """Get list of available Vietnamese voices.
    
    Returns:
        List of voice info dicts.
    """
    if not _HAS_EDGE_TTS:
        return []
    
    voices = await edge_tts.list_voices()
    vn_voices = [v for v in voices if v["Locale"].startswith("vi-VN")]
    
    return [
        {
            "name": v["ShortName"],
            "gender": v["Gender"],
            "locale": v["Locale"],
            "friendly_name": v.get("FriendlyName", v["ShortName"]),
        }
        for v in vn_voices
    ]
