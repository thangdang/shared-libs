"""Translation pipeline for English→Vietnamese content."""

from winlux.crawler.translate.pipeline import TranslationPipeline, TranslatedText
from winlux.crawler.translate.providers import OllamaTranslator, GoogleTranslateProvider

__all__ = [
    "TranslationPipeline",
    "TranslatedText",
    "OllamaTranslator",
    "GoogleTranslateProvider",
]
