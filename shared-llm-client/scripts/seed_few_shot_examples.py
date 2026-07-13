"""Seed ai_few_shot_examples collections for all products.

Creates initial few-shot examples in each product's MongoDB database
for the LiteAgent to use in prompt construction.

Release-2: Free AI Optimization — Task 9.1

Usage:
    python scripts/seed_few_shot_examples.py --product smartbuy
    python scripts/seed_few_shot_examples.py --all
"""

import argparse
import json
import logging
import os
from datetime import datetime, timezone

from pymongo import MongoClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
#  Product MongoDB URIs
# ═══════════════════════════════════════════════════════════════

PRODUCT_DBS = {
    "smartbuy": os.getenv("SMARTBUY_MONGO_URI", "mongodb://localhost:27017/smartbuy"),
    "trendbriefai": os.getenv("TRENDBRIEFAI_MONGO_URI", "mongodb://localhost:27017/trendbriefai"),
    "caremate": os.getenv("CAREMATE_MONGO_URI", "mongodb://localhost:27017/caremate"),
    "fintax": os.getenv("FINTAX_MONGO_URI", "mongodb://localhost:27017/fintax"),
    "childhood": os.getenv("CHILDHOOD_MONGO_URI", "mongodb://localhost:27017/childhood"),
    "doctorcar": os.getenv("DOCTORCAR_MONGO_URI", "mongodb://localhost:27017/doctorcar"),
}

COLLECTION_NAME = "ai_few_shot_examples"

# ═══════════════════════════════════════════════════════════════
#  SmartBuy Examples
# ═══════════════════════════════════════════════════════════════

SMARTBUY_EXAMPLES = [
    # query_intent examples
    {
        "task_type": "query_intent",
        "input_vi": {"query": "điện thoại dưới 10 triệu chụp hình đẹp"},
        "output": {"intent": "search", "product_category": "điện thoại", "brand": None, "price_range": "dưới 10 triệu", "urgency": "normal", "confidence": 0.9},
        "quality_score": 1.0,
    },
    {
        "task_type": "query_intent",
        "input_vi": {"query": "so sánh iPhone 15 với Samsung S24"},
        "output": {"intent": "compare", "product_category": "điện thoại", "brand": None, "price_range": None, "urgency": "normal", "confidence": 0.95},
        "quality_score": 1.0,
    },
    {
        "task_type": "query_intent",
        "input_vi": {"query": "laptop gaming tốt nhất cho sinh viên"},
        "output": {"intent": "recommend", "product_category": "laptop", "brand": None, "price_range": None, "urgency": "normal", "confidence": 0.85},
        "quality_score": 1.0,
    },
    {
        "task_type": "query_intent",
        "input_vi": {"query": "tai nghe Sony XM5 giá bao nhiêu"},
        "output": {"intent": "search", "product_category": "tai nghe", "brand": "Sony", "price_range": None, "urgency": "normal", "confidence": 0.9},
        "quality_score": 1.0,
    },
    {
        "task_type": "query_intent",
        "input_vi": {"query": "flash sale Shopee hôm nay có gì hay"},
        "output": {"intent": "search", "product_category": "", "brand": None, "price_range": None, "urgency": "flash_sale", "confidence": 0.8},
        "quality_score": 1.0,
    },
    # product_categorization examples
    {
        "task_type": "product_categorization",
        "input_vi": {"product_name": "Samsung Galaxy S24 Ultra 256GB"},
        "output": {"category": "điện thoại", "subcategory": "flagship", "confidence": 0.95},
        "quality_score": 1.0,
    },
    {
        "task_type": "product_categorization",
        "input_vi": {"product_name": "Máy hút bụi Dyson V15 Detect"},
        "output": {"category": "đồ gia dụng", "subcategory": "máy hút bụi", "confidence": 0.9},
        "quality_score": 1.0,
    },
]

# ═══════════════════════════════════════════════════════════════
#  CareMate Examples
# ═══════════════════════════════════════════════════════════════

CAREMATE_EXAMPLES = [
    {
        "task_type": "severity_scoring",
        "input_vi": {"symptoms": "đau đầu nhẹ, mệt mỏi, hơi sốt 37.5 độ"},
        "output": {"level": "low", "score": 3, "reasoning": "Sốt nhẹ + đau đầu thường do cảm cúm thông thường", "needs_doctor": False, "emergency": False, "confidence": 0.85},
        "quality_score": 1.0,
    },
    {
        "task_type": "severity_scoring",
        "input_vi": {"symptoms": "đau ngực trái, khó thở, tay trái tê"},
        "output": {"level": "emergency", "score": 10, "reasoning": "Triệu chứng giống nhồi máu cơ tim — CẦN CẤP CỨU", "needs_doctor": True, "emergency": True, "confidence": 0.95},
        "quality_score": 1.0,
    },
    {
        "task_type": "severity_scoring",
        "input_vi": {"symptoms": "ho khan 1 tuần, không sốt, vẫn ăn ngủ bình thường"},
        "output": {"level": "medium", "score": 4, "reasoning": "Ho kéo dài 1 tuần cần theo dõi, nên khám nếu không giảm", "needs_doctor": False, "emergency": False, "confidence": 0.8},
        "quality_score": 1.0,
    },
    {
        "task_type": "intent_classification",
        "input_vi": {"message": "panadol uống mấy viên"},
        "output": {"intent": "drug_info", "confidence": 0.9},
        "quality_score": 1.0,
    },
    {
        "task_type": "intent_classification",
        "input_vi": {"message": "bị đau bụng dưới rốn 3 ngày rồi"},
        "output": {"intent": "symptom_check", "confidence": 0.9},
        "quality_score": 1.0,
    },
]

# ═══════════════════════════════════════════════════════════════
#  FinTax Examples
# ═══════════════════════════════════════════════════════════════

FINTAX_EXAMPLES = [
    {
        "task_type": "income_classification",
        "input_vi": {"description": "Lương tháng từ công ty ABC, có đóng BHXH"},
        "output": {"category": "lương", "sub_category": "lương chính", "tax_type": "TNCN lũy tiến", "applicable_bracket": None, "deductible": True, "confidence": 0.95},
        "quality_score": 1.0,
    },
    {
        "task_type": "income_classification",
        "input_vi": {"description": "cho thuê nhà mặt phố quận 1, thu 15 triệu/tháng"},
        "output": {"category": "cho thuê", "sub_category": "cho thuê bất động sản", "tax_type": "TNCN 10%", "applicable_bracket": None, "deductible": False, "confidence": 0.9},
        "quality_score": 1.0,
    },
    {
        "task_type": "deduction_validation",
        "input_vi": {"expense": "mua bảo hiểm nhân thọ Prudential", "amount_vnd": 10000000},
        "output": {"qualifies": True, "category": "bảo hiểm", "max_amount_vnd": None, "regulation_ref": "Khoản 2 Điều 9 TT111/2013", "notes_vi": "Phí bảo hiểm nhân thọ được trừ nếu có hóa đơn", "confidence": 0.85},
        "quality_score": 1.0,
    },
    {
        "task_type": "deduction_validation",
        "input_vi": {"expense": "mua xe ô tô cá nhân", "amount_vnd": 800000000},
        "output": {"qualifies": False, "category": "khác", "max_amount_vnd": None, "regulation_ref": "", "notes_vi": "Chi phí mua xe cá nhân không được khấu trừ thuế TNCN", "confidence": 0.95},
        "quality_score": 1.0,
    },
]

# ═══════════════════════════════════════════════════════════════
#  DoctorCar Examples
# ═══════════════════════════════════════════════════════════════

DOCTORCAR_EXAMPLES = [
    {
        "task_type": "symptom_extraction",
        "input_vi": {"message": "xe em kêu cọc cọc ở bánh trước bên phải khi đi qua ổ gà"},
        "output": {"symptom_normalized": "tiếng kêu bất thường hệ treo trước phải", "body_system": "treo", "when_occurs": "đi qua mặt đường xấu", "severity_hint": "medium", "related_parts": ["rotuyn", "cao su chữ A", "giảm chấn"]},
        "quality_score": 1.0,
    },
    {
        "task_type": "symptom_extraction",
        "input_vi": {"message": "xe bị rung vô lăng khi chạy 80km/h trở lên"},
        "output": {"symptom_normalized": "rung vô lăng ở tốc độ cao", "body_system": "treo", "when_occurs": "tốc độ > 80km/h", "severity_hint": "medium", "related_parts": ["cân bằng động", "moay ơ", "rô tuyn lái"]},
        "quality_score": 1.0,
    },
    {
        "task_type": "safety_check",
        "input_vi": {"symptoms": ["phanh kêu rít kim loại", "đạp phanh sâu hơn bình thường"]},
        "output": {"is_safe_to_drive": False, "severity": 5, "immediate_action": "Dừng xe, không lái tiếp. Gọi cứu hộ đến garage.", "warning_vi": "NGUY HIỂM: Hệ thống phanh có vấn đề nghiêm trọng", "recall_related": False, "confidence": 0.95},
        "quality_score": 1.0,
    },
    {
        "task_type": "cost_estimation",
        "input_vi": {"part_or_service": "thay má phanh trước", "region": "HCM"},
        "output": {"part_name_vi": "Má phanh trước", "oem_price_range": "800K-1.5M VND", "aftermarket_price_range": "400K-900K VND", "labor_cost_range": "200K-400K VND", "region": "HCM", "total_estimate": "600K-1.9M VND", "confidence": 0.8},
        "quality_score": 1.0,
    },
]

# ═══════════════════════════════════════════════════════════════
#  TrendBrief Examples
# ═══════════════════════════════════════════════════════════════

TRENDBRIEFAI_EXAMPLES = [
    {
        "task_type": "article_categorization",
        "input_vi": {"title": "Apple ra mắt iPhone 17 Pro với chip A19 Bionic"},
        "output": {"primary_category": "công nghệ", "sub_category": "smartphone", "tags": ["Apple", "iPhone", "ra mắt"], "language": "vi", "confidence": 0.95},
        "quality_score": 1.0,
    },
    {
        "task_type": "article_categorization",
        "input_vi": {"title": "VN-Index giảm 15 điểm, nhà đầu tư bán tháo"},
        "output": {"primary_category": "kinh doanh", "sub_category": "chứng khoán", "tags": ["VN-Index", "chứng khoán", "bán tháo"], "language": "vi", "confidence": 0.9},
        "quality_score": 1.0,
    },
    {
        "task_type": "trend_scoring",
        "input_vi": {"title": "ChatGPT 5 sắp ra mắt", "source": "VnExpress", "engagement": {"shares": 500, "comments": 200}},
        "output": {"score": 85, "virality": "high", "competition": "high", "timeliness": "breaking", "target_audience": "người quan tâm công nghệ", "confidence": 0.85},
        "quality_score": 1.0,
    },
]

# ═══════════════════════════════════════════════════════════════
#  Childhood (Video Engine) Examples
# ═══════════════════════════════════════════════════════════════

CHILDHOOD_EXAMPLES = [
    {
        "task_type": "hook_scoring",
        "input_vi": {"hook": "Bạn có nhớ trò chơi bắn bi hồi bé không?"},
        "output": {"score": 82, "hook_type": "nostalgia", "strengths": ["gợi ký ức tuổi thơ", "câu hỏi trực tiếp"], "weaknesses": [], "suggestion_vi": "", "confidence": 0.85},
        "quality_score": 1.0,
    },
    {
        "task_type": "hook_scoring",
        "input_vi": {"hook": "5 trò chơi tuổi thơ bạn không thể quên"},
        "output": {"score": 75, "hook_type": "list", "strengths": ["số cụ thể", "promise rõ ràng"], "weaknesses": ["hơi generic"], "suggestion_vi": "Thêm yếu tố bất ngờ: '5 trò chơi tuổi thơ bạn CHẮC CHẮN đã từng chơi'", "confidence": 0.8},
        "quality_score": 1.0,
    },
    {
        "task_type": "topic_scoring",
        "input_vi": {"topic": "trò chơi bắn bi", "niche": "tuoi-tho"},
        "output": {"selected_topic": "trò chơi bắn bi", "score": 78, "reasoning_vi": "Topic nostalgia mạnh, nhiều người 8x 9x nhớ, dễ visual", "angle": "Luật chơi + kỷ niệm + so sánh bây giờ", "estimated_views": "medium", "related_topics": ["nhảy dây", "trốn tìm", "đánh đáo"], "confidence": 0.8},
        "quality_score": 1.0,
    },
]

# ═══════════════════════════════════════════════════════════════
#  Seeding Logic
# ═══════════════════════════════════════════════════════════════

ALL_EXAMPLES = {
    "smartbuy": SMARTBUY_EXAMPLES,
    "caremate": CAREMATE_EXAMPLES,
    "fintax": FINTAX_EXAMPLES,
    "doctorcar": DOCTORCAR_EXAMPLES,
    "trendbriefai": TRENDBRIEFAI_EXAMPLES,
    "childhood": CHILDHOOD_EXAMPLES,
}


def seed_product(product: str) -> int:
    """Seed few-shot examples for a single product.

    Returns:
        Number of examples inserted.
    """
    if product not in PRODUCT_DBS:
        logger.error(f"Unknown product: {product}")
        return 0

    uri = PRODUCT_DBS[product]
    examples = ALL_EXAMPLES.get(product, [])

    if not examples:
        logger.warning(f"No examples defined for {product}")
        return 0

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        db_name = uri.rsplit("/", 1)[-1].split("?")[0]
        db = client[db_name]
        collection = db[COLLECTION_NAME]

        # Upsert each example (avoid duplicates)
        inserted = 0
        for ex in examples:
            doc = {
                **ex,
                "product": product,
                "created_at": datetime.now(timezone.utc),
            }

            # Use task_type + input as unique key
            filter_key = {
                "task_type": ex["task_type"],
                "input_vi": ex["input_vi"],
            }

            result = collection.update_one(
                filter_key,
                {"$set": doc},
                upsert=True,
            )
            if result.upserted_id:
                inserted += 1

        # Create indexes
        collection.create_index([("task_type", 1), ("quality_score", -1)])
        collection.create_index([("product", 1)])

        client.close()
        logger.info(f"[{product}] Seeded {inserted} new examples (total: {len(examples)} in collection)")
        return inserted

    except Exception as e:
        logger.error(f"[{product}] Seeding failed: {e}")
        return 0


def seed_all() -> dict:
    """Seed all products."""
    results = {}
    for product in ALL_EXAMPLES:
        results[product] = seed_product(product)
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed ai_few_shot_examples for products")
    parser.add_argument("--product", choices=list(ALL_EXAMPLES.keys()), help="Specific product to seed")
    parser.add_argument("--all", action="store_true", help="Seed all products")
    args = parser.parse_args()

    if args.all:
        results = seed_all()
        total = sum(results.values())
        logger.info(f"Seeding complete: {total} total new examples across {len(results)} products")
        for product, count in results.items():
            logger.info(f"  {product}: {count} inserted")
    elif args.product:
        count = seed_product(args.product)
        logger.info(f"Done: {count} examples inserted for {args.product}")
    else:
        parser.print_help()
