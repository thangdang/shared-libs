"""Prompt injection guard — detects and blocks injection attempts.

Checks user input for prompt injection patterns in English, Vietnamese,
and encoded forms.  Designed for ≤5ms per check (regex only, no ML).

Usage:
    guard = PromptGuard()
    result = guard.check(user_input)
    if not result["safe"]:
        # Block or sanitize the input
"""

import re
import logging
from typing import Dict

logger = logging.getLogger(__name__)


# Injection patterns — English
INJECTION_PATTERNS_EN = [
    r"ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)",
    r"forget\s+(everything|all|your)\s+(above|previous|prior|instructions?)",
    r"you\s+are\s+now\s+(a|an|the)?\s*(different|new|evil|unrestricted)",
    r"(disregard|override|bypass)\s+(all\s+)?(safety|rules?|guidelines?|restrictions?|constraints?)",
    r"pretend\s+(you\s+are|to\s+be|you're)\s+(a|an)?\s*",
    r"from\s+now\s+on[,\s]+(you\s+)?(are|will|must|should)",
    r"(system|admin)\s*(prompt|message|instruction)\s*[:=]",
    r"\[SYSTEM\]|\[INST\]|\[/INST\]|<<SYS>>|<\|im_start\|>",
    r"(jailbreak|DAN|do\s+anything\s+now)",
    r"respond\s+without\s+(any\s+)?(restrictions?|limitations?|filters?|safety)",
    r"(act|behave)\s+as\s+(if|though)\s+(you\s+)?(have\s+no|there\s+are\s+no)\s+(rules?|restrictions?)",
]

# Injection patterns — Vietnamese
INJECTION_PATTERNS_VI = [
    r"bỏ\s+qua\s+(tất\s+cả\s+)?(hướng\s+dẫn|quy\s+tắc|lệnh)\s+(trước|cũ|trên)",
    r"quên\s+(hết|tất\s+cả)\s+(những\s+)?gì\s+(đã\s+)?nói\s+(trước|ở\s+trên)",
    r"từ\s+(bây\s+giờ|giờ)\s+(bạn|mày)\s+(là|sẽ|phải)",
    r"(bạn|mày)\s+bây\s+giờ\s+là\s+(một\s+)?(con|cái|thằng)",
    r"(hãy|vui\s+lòng)\s+(bỏ|loại\s+bỏ|xóa)\s+(tất\s+cả\s+)?(giới\s+hạn|hạn\s+chế|quy\s+tắc)",
    r"không\s+cần\s+(tuân\s+theo|theo)\s+(quy\s+tắc|hướng\s+dẫn|lệnh)",
]

# Encoded injection patterns (base64, hex, unicode tricks)
INJECTION_PATTERNS_ENCODED = [
    r"(?:&#x?[0-9a-fA-F]+;){5,}",  # HTML entity encoding
    r"(?:%[0-9a-fA-F]{2}){5,}",     # URL encoding
    r"\x00|\x01|\x02|\x03",          # Null bytes / control chars
]

# Compile all patterns
_ALL_PATTERNS = []
for pattern in INJECTION_PATTERNS_EN + INJECTION_PATTERNS_VI + INJECTION_PATTERNS_ENCODED:
    try:
        _ALL_PATTERNS.append(re.compile(pattern, re.IGNORECASE | re.UNICODE))
    except re.error:
        logger.warning(f"Failed to compile injection pattern: {pattern}")


class PromptGuard:
    """Detects prompt injection attempts in user input.

    Performance target: ≤5ms per check (regex-only, no ML).
    """

    def __init__(self, strict: bool = False):
        """Initialize guard.

        Args:
            strict: If True, also flag suspicious but ambiguous patterns.
        """
        self._strict = strict
        self._patterns = _ALL_PATTERNS

    def check(self, text: str) -> Dict:
        """Check text for prompt injection patterns.

        Args:
            text: User input text to check.

        Returns:
            Dict with:
                safe: bool — True if no injection detected
                action: "allow" | "block" | "sanitize" | "warn"
                reason: str — description of detected pattern (empty if safe)
                pattern_name: str — which pattern triggered (empty if safe)
        """
        if not text or len(text) < 10:
            return {"safe": True, "action": "allow", "reason": "", "pattern_name": ""}

        for i, pattern in enumerate(self._patterns):
            match = pattern.search(text)
            if match:
                matched_text = match.group(0)
                pattern_name = self._get_pattern_name(i)

                logger.warning(
                    f"Prompt injection detected: pattern={pattern_name}, "
                    f"matched='{matched_text[:50]}'"
                )

                return {
                    "safe": False,
                    "action": "block",
                    "reason": f"Injection pattern detected: {pattern_name}",
                    "pattern_name": pattern_name,
                }

        return {"safe": True, "action": "allow", "reason": "", "pattern_name": ""}

    def check_data_ingestion(self, text: str, source: str) -> Dict:
        """Check crawled/ingested data for embedded injection attempts.

        Used when processing RSS content, community posts, product descriptions, etc.

        Args:
            text: Crawled content to check.
            source: Source identifier (for logging).

        Returns:
            Same dict format as check().
        """
        result = self.check(text)
        if not result["safe"]:
            logger.warning(
                f"Injection in ingested data from {source}: {result['reason']}"
            )
            result["action"] = "sanitize"  # Don't block ingestion, just sanitize
        return result

    def sanitize_injection(self, text: str) -> str:
        """Remove injection patterns from text (for ingested data).

        Args:
            text: Text with potential injections.

        Returns:
            Cleaned text with injection patterns removed.
        """
        clean = text
        for pattern in self._patterns:
            clean = pattern.sub("[REMOVED]", clean)
        return clean

    def _get_pattern_name(self, index: int) -> str:
        """Get human-readable name for pattern by index."""
        en_count = len(INJECTION_PATTERNS_EN)
        vi_count = len(INJECTION_PATTERNS_VI)

        if index < en_count:
            return f"en_injection_{index}"
        elif index < en_count + vi_count:
            return f"vi_injection_{index - en_count}"
        else:
            return f"encoded_injection_{index - en_count - vi_count}"
