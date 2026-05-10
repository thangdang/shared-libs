/**
 * CareMate Emergency Detection Service
 *
 * Rule-based emergency red-flag detection using keyword matching.
 * Runs entirely on VPS without requiring the AI engine.
 * Emergency check runs BEFORE AI engine contact or cache lookup.
 */

/** Vietnamese emergency keywords indicating critical health situations */
const EMERGENCY_KEYWORDS: string[] = [
  'đau ngực',
  'khó thở',
  'chảy máu nhiều',
  'bất tỉnh',
  'co giật',
  'sốt cao',
  'ngộ độc',
  'tai nạn',
  'đột quỵ',
  'ngừng thở',
  'hôn mê',
  'chấn thương nặng',
  'gãy xương',
  'bỏng nặng',
  'dị ứng nặng',
  'sốc phản vệ',
  'xuất huyết',
  'mất ý thức',
  'tim ngừng đập',
  'ngạt thở',
];

/**
 * Detect if a user message contains emergency health keywords.
 *
 * @param message - User's message text
 * @returns true if emergency keywords are detected
 */
export function detectEmergency(message: string): boolean {
  const normalized = message.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => normalized.includes(kw));
}

/**
 * Get the emergency response message directing user to call 115.
 *
 * @returns Emergency response string with 115 hotline
 */
export function getEmergencyResponse(): string {
  return (
    '⚠️ CẢNH BÁO KHẨN CẤP: Vui lòng gọi 115 ngay lập tức. ' +
    'Đây có thể là tình huống y tế khẩn cấp cần được xử lý bởi chuyên gia y tế. ' +
    'Không chờ đợi - hãy gọi cấp cứu ngay!'
  );
}

/**
 * Get the list of emergency keywords (for testing/configuration).
 */
export function getEmergencyKeywords(): string[] {
  return [...EMERGENCY_KEYWORDS];
}
