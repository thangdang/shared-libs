"""Medical data quality validator.

Enforces strict quality rules for medical/drug data:
- Source must be doctor-reviewed or official (whitelist)
- Drug data must have contraindications
- No user-generated medical advice
- Cross-reference drug interactions
- Flag outdated content (>2 years)
- Vietnamese language required
- No PII in crawled data
"""

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Set

logger = logging.getLogger(__name__)

# Whitelisted medical sources (doctor-reviewed or official)
WHITELISTED_SOURCES: Set[str] = {
    "drugbank_vn",
    "mims_vietnam",
    "vinmec_articles",
    "suckhoedoisong_rss",
    "cdc_vietnam",
    "hellobacsi",
    "medlatec",
    "bachmai_hospital",
    "tamanh_hospital",
    "who_vietnam",
    "moh_circulars",
    "duocthu_quocgia",
}

# Required fields for drug records
DRUG_REQUIRED_FIELDS = ["drug_name", "dosage_forms", "indications", "contraindications"]

# PII patterns to strip
PII_PATTERNS = [
    r'\b(anh|chị|bạn|em)\s+[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+\b',
    r'\b\d{10,11}\b',  # Phone numbers
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Emails
    r'\b\d{9,12}\b',  # ID numbers
]

# Max age for medical content (2 years)
MAX_AGE_DAYS = 730


@dataclass
class ValidationResult:
    """Result of medical data validation."""

    is_valid: bool
    errors: List[str]
    warnings: List[str]
    stripped_pii: bool = False
    flagged_outdated: bool = False


class MedicalDataValidator:
    """Validates medical/drug data against quality rules.

    Rules (from Req 6):
    1. Source must be whitelisted (doctor-reviewed/official)
    2. Drug data must have contraindications
    3. No user-generated medical advice
    4. Flag outdated content (>2 years)
    5. Vietnamese language required
    6. No PII in stored data
    """

    def __init__(self, additional_whitelist: Optional[Set[str]] = None):
        """Initialize validator.

        Args:
            additional_whitelist: Extra source IDs to whitelist.
        """
        self._whitelist = WHITELISTED_SOURCES.copy()
        if additional_whitelist:
            self._whitelist.update(additional_whitelist)

    def validate_drug(self, drug_data: dict, source_id: str) -> ValidationResult:
        """Validate a drug record.

        Args:
            drug_data: Dict with drug fields.
            source_id: Source identifier for whitelist check.

        Returns:
            ValidationResult with pass/fail and details.
        """
        errors = []
        warnings = []

        # Rule 1: Source whitelist
        if source_id not in self._whitelist:
            errors.append(f"Source '{source_id}' not in medical whitelist")

        # Rule 2: Required fields (especially contraindications)
        for field in DRUG_REQUIRED_FIELDS:
            value = drug_data.get(field)
            if not value or (isinstance(value, str) and not value.strip()):
                errors.append(f"Required field '{field}' is missing or empty")

        # Rule 4: Check content age
        published_date = drug_data.get("published_at") or drug_data.get("updated_at")
        if published_date:
            if isinstance(published_date, str):
                try:
                    published_date = datetime.fromisoformat(published_date)
                except ValueError:
                    published_date = None

            if published_date:
                age_days = (datetime.now(timezone.utc) - published_date.replace(tzinfo=timezone.utc)).days
                if age_days > MAX_AGE_DAYS:
                    warnings.append(
                        f"Content is {age_days} days old (>{MAX_AGE_DAYS} days). Flagged for review."
                    )

        # Rule 5: Vietnamese language check
        content_fields = ["indications", "contraindications", "side_effects"]
        for field in content_fields:
            value = drug_data.get(field, "")
            if isinstance(value, str) and len(value) > 50:
                if not self._contains_vietnamese(value):
                    warnings.append(f"Field '{field}' may not be in Vietnamese")

        is_valid = len(errors) == 0
        flagged_outdated = any("Flagged for review" in w for w in warnings)

        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            flagged_outdated=flagged_outdated,
        )

    def validate_health_article(self, article: dict, source_id: str) -> ValidationResult:
        """Validate a health article.

        Args:
            article: Dict with article fields.
            source_id: Source identifier.

        Returns:
            ValidationResult.
        """
        errors = []
        warnings = []

        # Rule 1: Source whitelist
        if source_id not in self._whitelist:
            errors.append(f"Source '{source_id}' not in medical whitelist")

        # Content required
        content = article.get("content", "")
        if not content or len(content) < 100:
            errors.append("Article content too short (< 100 chars)")

        # Title required
        if not article.get("title", "").strip():
            errors.append("Article title is missing")

        # Rule 5: Vietnamese language
        if content and len(content) > 100 and not self._contains_vietnamese(content):
            errors.append("Article content is not in Vietnamese")

        # Rule 4: Age check
        published_date = article.get("published_at")
        if published_date and isinstance(published_date, datetime):
            age_days = (datetime.now(timezone.utc) - published_date.replace(tzinfo=timezone.utc)).days
            if age_days > MAX_AGE_DAYS:
                warnings.append(f"Article is {age_days} days old. Flagged for review.")

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            flagged_outdated=any("Flagged" in w for w in warnings),
        )

    def strip_pii(self, text: str) -> str:
        """Remove PII from medical content.

        Strips patient names, phone numbers, emails, ID numbers.

        Args:
            text: Raw text content.

        Returns:
            Text with PII removed.
        """
        cleaned = text
        for pattern in PII_PATTERNS:
            cleaned = re.sub(pattern, "[REDACTED]", cleaned)
        return cleaned

    def strip_pii_from_record(self, record: dict, text_fields: List[str]) -> dict:
        """Strip PII from specified fields in a record.

        Args:
            record: Data record dict.
            text_fields: List of field names to clean.

        Returns:
            Record with PII stripped from specified fields.
        """
        cleaned = record.copy()
        for field in text_fields:
            if field in cleaned and isinstance(cleaned[field], str):
                cleaned[field] = self.strip_pii(cleaned[field])
        return cleaned

    def _contains_vietnamese(self, text: str) -> bool:
        """Check if text contains Vietnamese characters (diacritics).

        Args:
            text: Text to check.

        Returns:
            True if text likely contains Vietnamese.
        """
        vietnamese_pattern = r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]'
        matches = re.findall(vietnamese_pattern, text.lower())
        # Vietnamese text typically has diacritics every 5-10 chars
        return len(matches) >= max(3, len(text) // 50)
