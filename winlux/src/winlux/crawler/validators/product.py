"""Product data quality validator for SmartBuy.

Validates crawled product data meets minimum quality standards:
- Name not empty
- Price > 0
- Image URL valid
- Required fields present
"""

import logging
import re
from dataclasses import dataclass
from typing import List

logger = logging.getLogger(__name__)


@dataclass
class ProductValidationResult:
    """Result of product data validation."""

    is_valid: bool
    errors: List[str]
    warnings: List[str]


class ProductDataValidator:
    """Validates crawled product data quality.

    Rules (from Req 2.3):
    - product_name not empty
    - price > 0
    - image_url is valid URL
    - Pass rate >= 90% to enable source
    """

    def validate(self, product: dict) -> ProductValidationResult:
        """Validate a single product record.

        Args:
            product: Dict with product fields.

        Returns:
            ProductValidationResult.
        """
        errors = []
        warnings = []

        # Name required
        name = product.get("product_name", "") or product.get("name", "")
        if not name or not name.strip():
            errors.append("Product name is empty")
        elif len(name.strip()) < 3:
            errors.append("Product name too short (< 3 chars)")

        # Price required and > 0
        price = product.get("price", 0)
        if isinstance(price, str):
            price = int(re.sub(r"[^\d]", "", price) or "0")
        if not price or price <= 0:
            errors.append("Price is missing or <= 0")
        elif price < 1000:  # Less than 1,000 VND is suspicious
            warnings.append(f"Price suspiciously low: {price} VND")
        elif price > 500_000_000:  # More than 500M VND is suspicious
            warnings.append(f"Price suspiciously high: {price} VND")

        # Image URL validation
        image_url = product.get("image_url", "")
        if not image_url:
            warnings.append("Image URL is missing")
        elif not self._is_valid_url(image_url):
            warnings.append(f"Image URL appears invalid: {image_url[:50]}")

        # Original price sanity check
        original_price = product.get("original_price", 0)
        if original_price and price and original_price < price:
            warnings.append("Original price is less than current price")

        return ProductValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )

    def validate_batch(self, products: List[dict]) -> dict:
        """Validate a batch of products and return pass rate.

        Args:
            products: List of product dicts.

        Returns:
            Dict with total, passed, failed, pass_rate, errors.
        """
        total = len(products)
        passed = 0
        failed = 0
        all_errors = []

        for i, product in enumerate(products):
            result = self.validate(product)
            if result.is_valid:
                passed += 1
            else:
                failed += 1
                all_errors.append({
                    "index": i,
                    "product_name": product.get("product_name", product.get("name", "unknown")),
                    "errors": result.errors,
                })

        pass_rate = passed / total if total > 0 else 0.0

        return {
            "total": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": round(pass_rate, 3),
            "meets_threshold": pass_rate >= 0.9,  # 90% threshold
            "errors": all_errors[:10],  # First 10 errors only
        }

    def _is_valid_url(self, url: str) -> bool:
        """Basic URL validation.

        Args:
            url: URL string to validate.

        Returns:
            True if URL looks valid.
        """
        return bool(re.match(r'^https?://.+\..+', url))
