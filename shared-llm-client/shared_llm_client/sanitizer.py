"""Prompt sanitizer — redacts PII before sending to external LLM providers.

Applies per-product regex rules to strip sensitive data (CCCD, MST, phone, bank accounts)
before external API calls. Skips sanitization for Ollama (local, private).

Usage:
    sanitizer = PromptSanitizer(product="caremate", sensitivity="high")
    clean_prompt = sanitizer.sanitize(prompt, provider="groq")
"""

import re
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class SanitizationResult:
    """Result of sanitization."""
    clean_text: str
    fields_redacted: int
    redacted_types: List[str]
    original_length: int


# Per-product regex patterns for sensitive data
PRODUCT_PATTERNS: Dict[str, List[Dict]] = {
    "caremate": [
        {"name": "cccd", "pattern": r"\b\d{9,12}\b", "context": r"(cccd|cmnd|chứng minh|căn cước)"},
        {"name": "phone_vn", "pattern": r"\b(0[3-9]\d{8})\b", "context": None},
        {"name": "patient_name", "pattern": r"(bệnh nhân|họ tên|tên):\s*([A-ZÀ-Ỹ][a-zà-ỹ]+(\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,4})", "context": None},
    ],
    "fintax": [
        {"name": "mst", "pattern": r"\b\d{10}(-\d{3})?\b", "context": r"(mst|mã số thuế|tax)"},
        {"name": "bank_account", "pattern": r"\b\d{10,19}\b", "context": r"(tài khoản|stk|bank|ngân hàng)"},
        {"name": "phone_vn", "pattern": r"\b(0[3-9]\d{8})\b", "context": None},
        {"name": "income_amount", "pattern": r"\b\d{1,3}([.,]\d{3}){2,}\b", "context": r"(lương|thu nhập|income|salary)"},
    ],
    "smartbuy": [
        {"name": "phone_vn", "pattern": r"\b(0[3-9]\d{8})\b", "context": None},
        {"name": "address", "pattern": r"(địa chỉ|giao hàng|ship):\s*.{10,100}", "context": None},
    ],
    "trendbriefai": [
        {"name": "phone_vn", "pattern": r"\b(0[3-9]\d{8})\b", "context": None},
    ],
    "childhood": [
        {"name": "phone_vn", "pattern": r"\b(0[3-9]\d{8})\b", "context": None},
    ],
    "doctorcar": [
        {"name": "phone_vn", "pattern": r"\b(0[3-9]\d{8})\b", "context": None},
        {"name": "license_plate", "pattern": r"\b\d{2}[A-Z]-?\d{3,5}\.?\d{0,2}\b", "context": None},
    ],
}

# Universal patterns (apply to all products)
UNIVERSAL_PATTERNS = [
    {"name": "email", "pattern": r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b", "context": None},
    {"name": "ip_address", "pattern": r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", "context": None},
]

# Providers that are LOCAL (skip sanitization)
LOCAL_PROVIDERS = {"ollama", "local", "vllm"}


class PromptSanitizer:
    """Sanitizes prompts by redacting PII before external LLM calls.

    Args:
        product: Product name (caremate, fintax, smartbuy, etc.)
        sensitivity: "high" (strict), "medium" (balanced), "low" (minimal)
    """

    def __init__(self, product: str, sensitivity: str = "medium"):
        self.product = product.lower()
        self.sensitivity = sensitivity
        self._patterns = self._build_patterns()

    def _build_patterns(self) -> List[Dict]:
        """Build regex pattern list for this product."""
        patterns = list(UNIVERSAL_PATTERNS)

        # Add product-specific patterns
        product_pats = PRODUCT_PATTERNS.get(self.product, [])
        patterns.extend(product_pats)

        return patterns

    def sanitize(self, text: str, provider: str = "ollama") -> SanitizationResult:
        """Sanitize text if being sent to external provider.

        Args:
            text: Input text (prompt or context).
            provider: Target LLM provider name.

        Returns:
            SanitizationResult with clean text and redaction stats.
        """
        # Skip for local providers
        if provider.lower() in LOCAL_PROVIDERS:
            return SanitizationResult(
                clean_text=text,
                fields_redacted=0,
                redacted_types=[],
                original_length=len(text),
            )

        clean = text
        redacted_count = 0
        redacted_types = []

        for pattern_info in self._patterns:
            name = pattern_info["name"]
            pattern = pattern_info["pattern"]
            context_pattern = pattern_info.get("context")

            if context_pattern:
                # Only redact if context words are nearby (within 100 chars)
                context_regex = re.compile(context_pattern, re.IGNORECASE)
                if not context_regex.search(clean):
                    continue

            regex = re.compile(pattern, re.IGNORECASE)
            matches = regex.findall(clean)

            if matches:
                replacement = f"[REDACTED_{name.upper()}]"
                clean = regex.sub(replacement, clean)
                redacted_count += len(matches)
                if name not in redacted_types:
                    redacted_types.append(name)

        if redacted_count > 0:
            logger.info(
                f"Sanitized prompt for {provider}: "
                f"{redacted_count} fields redacted ({', '.join(redacted_types)})"
            )

        return SanitizationResult(
            clean_text=clean,
            fields_redacted=redacted_count,
            redacted_types=redacted_types,
            original_length=len(text),
        )

    def should_force_local(self) -> bool:
        """Check if sensitivity requires local-only processing."""
        return self.sensitivity == "high"
