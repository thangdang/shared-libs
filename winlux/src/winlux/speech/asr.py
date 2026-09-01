"""
Whisper ASR Service — Vietnamese Speech-to-Text
────────────────────────────────────────────────
Shared ASR component for caremate-ai, doctor-car-ai, smartbuy-ai.

Features:
  - OpenAI Whisper model (local or API)
  - Vietnamese dialect preprocessing
  - Noise reduction
  - Streaming support
  - Medical/automotive vocabulary boosting
  - Slang normalization post-processing

Models:
  - tiny: Fast, lower accuracy (good for real-time)
  - base: Balanced (recommended for mobile)
  - small: Better accuracy (recommended for desktop)
  - medium: High accuracy
  - large-v3: Best accuracy (requires GPU)
"""

import asyncio
import io
import logging
import os
import tempfile
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import AsyncIterator, BinaryIO

logger = logging.getLogger("winlux.speech.asr")

# Check for whisper availability
try:
    import whisper
    _HAS_WHISPER = True
except ImportError:
    _HAS_WHISPER = False
    whisper = None

# Check for faster-whisper (optimized)
try:
    from faster_whisper import WhisperModel as FasterWhisperModel
    _HAS_FASTER_WHISPER = True
except ImportError:
    _HAS_FASTER_WHISPER = False
    FasterWhisperModel = None

# Check for OpenAI API
try:
    import openai
    _HAS_OPENAI = True
except ImportError:
    _HAS_OPENAI = False
    openai = None


class WhisperBackend(Enum):
    """Available Whisper backends."""

    LOCAL = "local"              # Original whisper (PyTorch)
    FASTER = "faster"            # faster-whisper (CTranslate2)
    OPENAI_API = "openai_api"    # OpenAI Whisper API


class WhisperModel(Enum):
    """Available Whisper model sizes."""

    TINY = "tiny"
    BASE = "base"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large-v3"


@dataclass
class ASRConfig:
    """ASR configuration."""

    model: WhisperModel = WhisperModel.BASE
    backend: WhisperBackend = WhisperBackend.LOCAL
    language: str = "vi"
    
    # Processing options
    normalize_slang: bool = True
    boost_medical_vocab: bool = False
    boost_automotive_vocab: bool = False
    
    # Performance
    device: str = "auto"  # "cpu", "cuda", "auto"
    compute_type: str = "int8"  # for faster-whisper: "float16", "int8", "int8_float16"
    
    # API options (for OPENAI_API backend)
    api_key: str | None = None
    
    # Streaming
    chunk_length_s: float = 30.0


@dataclass
class ASRResult:
    """ASR transcription result."""

    text: str
    language: str = "vi"
    confidence: float = 0.0
    duration_s: float = 0.0
    segments: list[dict] = field(default_factory=list)
    
    # Post-processing flags
    slang_normalized: bool = False
    vocab_boosted: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
#  Vietnamese Dialect Preprocessing
# ═══════════════════════════════════════════════════════════════════════════════

# Common Vietnamese speech patterns that Whisper may misrecognize
VN_SPEECH_CORRECTIONS = {
    # Common misrecognitions
    "da vang": "dạ vâng",
    "cam on": "cảm ơn",
    "xin chao": "xin chào",
    "khong co": "không có",
    "duoc khong": "được không",
    "lam on": "làm ơn",
    
    # Medical terms (for caremate-ai)
    "dau dau": "đau đầu",
    "dau bung": "đau bụng",
    "sot": "sốt",
    "ho": "ho",
    "kho tho": "khó thở",
    "chong mat": "chóng mặt",
    "buon non": "buồn nôn",
    "tieu chay": "tiêu chảy",
    
    # Automotive terms (for doctor-car-ai)
    "xe hoi": "xe hơi",
    "o to": "ô tô",
    "dong co": "động cơ",
    "phanh": "phanh",
    "lop xe": "lốp xe",
    "binh ac quy": "bình ắc quy",
    "dau nhot": "dầu nhớt",
}

# Medical vocabulary boost
MEDICAL_VOCAB = [
    "triệu chứng", "bệnh", "thuốc", "đau", "sốt", "ho", "khó thở",
    "chóng mặt", "buồn nôn", "tiêu chảy", "táo bón", "dị ứng",
    "huyết áp", "tiểu đường", "tim mạch", "đột quỵ", "nhồi máu",
    "co giật", "bất tỉnh", "chảy máu", "gãy xương", "bỏng",
    "nhiễm trùng", "viêm", "ung thư", "hen suyễn", "covid",
]

# Automotive vocabulary boost
AUTOMOTIVE_VOCAB = [
    "động cơ", "phanh", "lốp", "bánh xe", "bình ắc quy", "dầu nhớt",
    "hộp số", "côn", "ga", "vô lăng", "gương", "đèn", "còi",
    "điều hòa", "két nước", "bugi", "kim phun", "bơm xăng",
    "giảm xóc", "thắng", "tay lái", "cửa kính", "gạt mưa",
]


def _preprocess_audio(audio_bytes: bytes) -> bytes:
    """Preprocess audio for better Vietnamese recognition.
    
    - Normalize volume
    - Reduce background noise (if pydub available)
    """
    try:
        from pydub import AudioSegment
        from pydub.effects import normalize, low_pass_filter
        
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        
        # Normalize volume
        audio = normalize(audio)
        
        # Light noise reduction via low-pass filter
        audio = low_pass_filter(audio, 8000)
        
        # Export back to bytes
        buffer = io.BytesIO()
        audio.export(buffer, format="wav")
        return buffer.getvalue()
    except ImportError:
        # pydub not available, return original
        return audio_bytes
    except Exception as e:
        logger.warning(f"Audio preprocessing failed: {e}")
        return audio_bytes


def _postprocess_text(text: str, config: ASRConfig) -> tuple[str, bool, bool]:
    """Post-process transcribed text.
    
    Returns:
        (processed_text, slang_normalized, vocab_boosted)
    """
    slang_normalized = False
    vocab_boosted = False
    
    # Apply speech corrections
    text_lower = text.lower()
    for wrong, correct in VN_SPEECH_CORRECTIONS.items():
        if wrong in text_lower:
            text = text.replace(wrong, correct)
            text = text.replace(wrong.title(), correct.title())
    
    # Normalize slang
    if config.normalize_slang:
        try:
            from winlux.nlp.slang import normalize_slang
            original = text
            text = normalize_slang(text)
            slang_normalized = text != original
        except ImportError:
            pass
    
    # Vocabulary boosting is handled during recognition (prompt engineering)
    # This flag indicates if it was requested
    vocab_boosted = config.boost_medical_vocab or config.boost_automotive_vocab
    
    return text, slang_normalized, vocab_boosted


def _get_initial_prompt(config: ASRConfig) -> str:
    """Generate initial prompt for vocabulary boosting."""
    prompt_parts = ["Đây là tiếng Việt."]
    
    if config.boost_medical_vocab:
        prompt_parts.append("Từ vựng y tế: " + ", ".join(MEDICAL_VOCAB[:15]))
    
    if config.boost_automotive_vocab:
        prompt_parts.append("Từ vựng ô tô: " + ", ".join(AUTOMOTIVE_VOCAB[:15]))
    
    return " ".join(prompt_parts)


# ═══════════════════════════════════════════════════════════════════════════════
#  Whisper ASR Class
# ═══════════════════════════════════════════════════════════════════════════════

class WhisperASR:
    """Whisper ASR service for Vietnamese speech recognition."""
    
    def __init__(self, config: ASRConfig | None = None):
        self.config = config or ASRConfig()
        self._model = None
        self._loaded = False
    
    async def load(self) -> None:
        """Load the Whisper model."""
        if self._loaded:
            return
        
        if self.config.backend == WhisperBackend.OPENAI_API:
            if not _HAS_OPENAI:
                raise ImportError("openai package required for OPENAI_API backend")
            self._loaded = True
            return
        
        if self.config.backend == WhisperBackend.FASTER:
            if not _HAS_FASTER_WHISPER:
                raise ImportError("faster-whisper package required for FASTER backend")
            
            device = self.config.device
            if device == "auto":
                device = "cuda" if self._cuda_available() else "cpu"
            
            self._model = FasterWhisperModel(
                self.config.model.value,
                device=device,
                compute_type=self.config.compute_type,
            )
            self._loaded = True
            return
        
        # Local whisper backend
        if not _HAS_WHISPER:
            raise ImportError("whisper package required for LOCAL backend")
        
        device = self.config.device
        if device == "auto":
            device = "cuda" if self._cuda_available() else "cpu"
        
        # Run model loading in thread pool (CPU-bound)
        loop = asyncio.get_event_loop()
        self._model = await loop.run_in_executor(
            None, whisper.load_model, self.config.model.value, device
        )
        self._loaded = True
    
    def _cuda_available(self) -> bool:
        """Check if CUDA is available."""
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            return False
    
    async def transcribe(self, audio: bytes | BinaryIO | Path | str) -> ASRResult:
        """Transcribe audio to text.
        
        Args:
            audio: Audio data as bytes, file-like object, or path.
        
        Returns:
            ASRResult with transcription.
        """
        await self.load()
        
        # Get audio bytes
        if isinstance(audio, (str, Path)):
            audio_path = Path(audio)
            audio_bytes = audio_path.read_bytes()
        elif isinstance(audio, bytes):
            audio_bytes = audio
        else:
            audio_bytes = audio.read()
        
        # Preprocess audio
        audio_bytes = _preprocess_audio(audio_bytes)
        
        # Route to appropriate backend
        if self.config.backend == WhisperBackend.OPENAI_API:
            result = await self._transcribe_openai(audio_bytes)
        elif self.config.backend == WhisperBackend.FASTER:
            result = await self._transcribe_faster(audio_bytes)
        else:
            result = await self._transcribe_local(audio_bytes)
        
        # Post-process
        text, slang_norm, vocab_boost = _postprocess_text(result.text, self.config)
        result.text = text
        result.slang_normalized = slang_norm
        result.vocab_boosted = vocab_boost
        
        return result
    
    async def _transcribe_local(self, audio_bytes: bytes) -> ASRResult:
        """Transcribe using local Whisper model."""
        # Write to temp file (whisper requires file path)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name
        
        try:
            loop = asyncio.get_event_loop()
            initial_prompt = _get_initial_prompt(self.config)
            
            result = await loop.run_in_executor(
                None,
                lambda: self._model.transcribe(
                    temp_path,
                    language=self.config.language,
                    initial_prompt=initial_prompt,
                )
            )
            
            segments = [
                {
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"],
                }
                for seg in result.get("segments", [])
            ]
            
            return ASRResult(
                text=result["text"].strip(),
                language=result.get("language", "vi"),
                confidence=0.0,  # Local whisper doesn't provide confidence
                duration_s=segments[-1]["end"] if segments else 0.0,
                segments=segments,
            )
        finally:
            os.unlink(temp_path)
    
    async def _transcribe_faster(self, audio_bytes: bytes) -> ASRResult:
        """Transcribe using faster-whisper."""
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name
        
        try:
            loop = asyncio.get_event_loop()
            initial_prompt = _get_initial_prompt(self.config)
            
            def _run():
                segments_gen, info = self._model.transcribe(
                    temp_path,
                    language=self.config.language,
                    initial_prompt=initial_prompt,
                    vad_filter=True,
                )
                segments = list(segments_gen)
                return segments, info
            
            segments, info = await loop.run_in_executor(None, _run)
            
            text = " ".join(seg.text for seg in segments)
            
            segment_list = [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                    "confidence": seg.avg_logprob,
                }
                for seg in segments
            ]
            
            avg_confidence = (
                sum(seg.avg_logprob for seg in segments) / len(segments)
                if segments else 0.0
            )
            
            return ASRResult(
                text=text.strip(),
                language=info.language,
                confidence=avg_confidence,
                duration_s=info.duration,
                segments=segment_list,
            )
        finally:
            os.unlink(temp_path)
    
    async def _transcribe_openai(self, audio_bytes: bytes) -> ASRResult:
        """Transcribe using OpenAI Whisper API."""
        api_key = self.config.api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OpenAI API key required for OPENAI_API backend")
        
        client = openai.AsyncOpenAI(api_key=api_key)
        
        # Create file-like object
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "audio.wav"
        
        initial_prompt = _get_initial_prompt(self.config)
        
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=self.config.language,
            prompt=initial_prompt,
            response_format="verbose_json",
        )
        
        segments = [
            {
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
                "text": seg.get("text", ""),
            }
            for seg in getattr(response, "segments", [])
        ]
        
        return ASRResult(
            text=response.text.strip(),
            language=getattr(response, "language", "vi"),
            confidence=0.9,  # API doesn't provide confidence, assume high
            duration_s=getattr(response, "duration", 0.0),
            segments=segments,
        )
    
    async def transcribe_stream(
        self, audio_stream: AsyncIterator[bytes]
    ) -> AsyncIterator[ASRResult]:
        """Transcribe streaming audio chunks.
        
        Yields partial results as audio is received.
        """
        await self.load()
        
        buffer = io.BytesIO()
        chunk_size = int(self.config.chunk_length_s * 16000 * 2)  # 16kHz, 16-bit
        
        async for chunk in audio_stream:
            buffer.write(chunk)
            
            if buffer.tell() >= chunk_size:
                # Process buffered audio
                audio_bytes = buffer.getvalue()
                buffer = io.BytesIO()
                
                result = await self.transcribe(audio_bytes)
                yield result


# ═══════════════════════════════════════════════════════════════════════════════
#  Module-level convenience functions
# ═══════════════════════════════════════════════════════════════════════════════

_default_asr: WhisperASR | None = None


def _get_asr(config: ASRConfig | None = None) -> WhisperASR:
    """Get or create default ASR instance."""
    global _default_asr
    if config is not None:
        return WhisperASR(config)
    if _default_asr is None:
        _default_asr = WhisperASR()
    return _default_asr


async def transcribe(
    audio: bytes | BinaryIO | Path | str,
    config: ASRConfig | None = None,
) -> ASRResult:
    """Transcribe audio to Vietnamese text.
    
    Args:
        audio: Audio data as bytes, file-like object, or path.
        config: Optional ASR configuration.
    
    Returns:
        ASRResult with transcription.
    
    Example:
        >>> result = await transcribe(audio_bytes)
        >>> print(result.text)
        "Tôi bị đau đầu"
    """
    asr = _get_asr(config)
    return await asr.transcribe(audio)


async def transcribe_file(
    path: str | Path,
    config: ASRConfig | None = None,
) -> ASRResult:
    """Transcribe audio file to Vietnamese text.
    
    Args:
        path: Path to audio file (mp3, wav, m4a, etc.)
        config: Optional ASR configuration.
    
    Returns:
        ASRResult with transcription.
    """
    asr = _get_asr(config)
    return await asr.transcribe(Path(path))


async def transcribe_stream(
    audio_stream: AsyncIterator[bytes],
    config: ASRConfig | None = None,
) -> AsyncIterator[ASRResult]:
    """Transcribe streaming audio.
    
    Args:
        audio_stream: Async iterator yielding audio chunks.
        config: Optional ASR configuration.
    
    Yields:
        ASRResult for each processed chunk.
    """
    asr = _get_asr(config)
    async for result in asr.transcribe_stream(audio_stream):
        yield result
