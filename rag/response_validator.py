"""Response Validator — Task 6.

Checks LLM response against retrieved documents to detect hallucination.
Detects: unknown entity mentions, numeric mismatches, refusal despite data.
Returns: {valid, issues, confidence}.
"""

import re
import logging

logger = logging.getLogger(__name__)


class ResponseValidator:
    """Validate LLM response is grounded in retrieved documents.

    Checks:
    1. Entity mentions not in context (hallucinated products/names)
    2. Numeric claims not matching context data
    3. Refusal to answer when data exists
    """

    def validate(self, response: str, retrieved_docs: list[dict], config: dict | None = None) -> dict:
        """Validate response against retrieved context.

        Args:
            response: LLM-generated response text
            retrieved_docs: List of retrieved documents (dicts with text/metadata)
            config: Validation config:
                - check_entities (bool): Check for unknown entity mentions
                - check_numbers (bool): Check numeric accuracy
                - known_entities (set): Pre-extracted entity set
                - context_numbers (list): Pre-extracted numbers from context

        Returns:
            dict with: valid (bool), issues (list[str]), confidence (float 0-1)
        """
        config = config or {}
        issues = []

        # 1. Check for entity mentions not in context
        if config.get("check_entities", True):
            entity_issues = self._check_entities(response, retrieved_docs, config)
            issues.extend(entity_issues)

        # 2. Check for numeric claims not in context
        if config.get("check_numbers", False):
            number_issues = self._check_numbers(response, retrieved_docs)
            issues.extend(number_issues)

        # 3. Check response doesn't refuse when data exists
        if retrieved_docs and self._is_refusal(response):
            issues.append("Refused to answer despite having relevant data")

        confidence = max(0.0, 1.0 - (len(issues) * 0.2))
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "confidence": round(confidence, 2),
        }

    def _check_entities(self, response: str, docs: list[dict], config: dict) -> list[str]:
        """Check if response mentions entities not in retrieved documents."""
        issues = []

        # Extract known entities from context
        known_entities = config.get("known_entities", set())
        if not known_entities:
            known_entities = self._extract_entities_from_docs(docs)

        # Simple check: look for product-like names in response not in context
        # This is a heuristic — not perfect but catches obvious hallucinations
        response_lower = response.lower()
        context_text = " ".join(d.get("document", d.get("text", "")) for d in docs).lower()

        # Check for brand/product patterns that might be hallucinated
        # Pattern: capitalized words that look like product names
        potential_products = re.findall(r'\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*\b', response)
        for product in potential_products:
            if product.lower() not in context_text and len(product) > 3:
                # Could be hallucinated — but only flag if it looks like a product name
                if any(kw in product.lower() for kw in ["phone", "pro", "max", "ultra", "plus"]):
                    issues.append(f"Possible hallucinated entity: '{product}'")

        return issues

    def _check_numbers(self, response: str, docs: list[dict]) -> list[str]:
        """Check if numbers in response match numbers in context."""
        issues = []

        # Extract numbers from response
        response_numbers = self._extract_numbers(response)
        if not response_numbers:
            return issues

        # Extract numbers from context
        context_text = " ".join(d.get("document", d.get("text", "")) for d in docs)
        context_numbers = self._extract_numbers(context_text)

        # Check each response number against context
        for num in response_numbers:
            if num < 1000:  # Skip small numbers (likely not prices/stats)
                continue
            if not self._number_in_context(num, context_numbers):
                issues.append(f"Number {num:,.0f} not found in context (possible hallucination)")

        return issues

    def _extract_numbers(self, text: str) -> list[float]:
        """Extract numeric values from text."""
        # Match Vietnamese price formats: 19.990.000, 19,990,000, 19990000
        numbers = []

        # Pattern for Vietnamese prices (dots as thousands separator)
        dot_prices = re.findall(r'\b(\d{1,3}(?:\.\d{3})+)\b', text)
        for p in dot_prices:
            numbers.append(float(p.replace(".", "")))

        # Pattern for plain numbers
        plain_numbers = re.findall(r'\b(\d{4,})\b', text)
        for n in plain_numbers:
            numbers.append(float(n))

        return numbers

    def _number_in_context(self, num: float, context_numbers: list[float], tolerance: float = 0.05) -> bool:
        """Check if a number exists in context (with tolerance)."""
        for ctx_num in context_numbers:
            if ctx_num == 0:
                continue
            if abs(num - ctx_num) / ctx_num <= tolerance:
                return True
        return False

    def _is_refusal(self, response: str) -> bool:
        """Check if response is a refusal/I-don't-know despite having data."""
        refusal_patterns = [
            "tôi không có thông tin",
            "chưa có thông tin",
            "không thể trả lời",
            "tôi không biết",
            "chưa có dữ liệu",
        ]
        response_lower = response.lower()
        return any(p in response_lower for p in refusal_patterns)

    def _extract_entities_from_docs(self, docs: list[dict]) -> set:
        """Extract entity names from retrieved documents."""
        entities = set()
        for doc in docs:
            meta = doc.get("metadata", {})
            if "name" in meta:
                entities.add(meta["name"].lower())
            if "brand" in meta:
                entities.add(meta["brand"].lower())
            if "product_name" in meta:
                entities.add(meta["product_name"].lower())
        return entities
