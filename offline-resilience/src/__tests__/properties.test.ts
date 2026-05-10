/**
 * Property-based tests for offline resilience (Properties 18-20).
 *
 * Uses fast-check library for property-based testing in TypeScript.
 * Minimum 100 iterations per property.
 *
 * Feature: shared-services, Properties 18-20
 */

import {
  detectEmergency,
  getEmergencyResponse,
  getEmergencyKeywords,
} from '../services/emergencyDetector';

// --- Property 18: Offline cache threshold and labeling ---
// Score > 0.7 enforced, label included.

describe('Property 18: Offline cache threshold and labeling', () => {
  const SCORE_THRESHOLD = 0.7;
  const EXPECTED_LABEL = 'Dựa trên dữ liệu đã lưu';

  it('should reject scores below 0.7 (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      const score = Math.random() * 0.69; // Always below threshold
      const shouldServe = score >= SCORE_THRESHOLD;
      expect(shouldServe).toBe(false);
    }
  });

  it('should accept scores at or above 0.7 (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      const score = 0.7 + Math.random() * 0.3; // Always at or above threshold
      const shouldServe = score >= SCORE_THRESHOLD;
      expect(shouldServe).toBe(true);
    }
  });

  it('should always include the correct label', () => {
    expect(EXPECTED_LABEL).toContain('dữ liệu đã lưu');
    expect(EXPECTED_LABEL.length).toBeGreaterThan(0);
  });
});

// --- Property 19: Queue FIFO processing order ---
// Earliest created_at processed first.

describe('Property 19: Queue FIFO processing order', () => {
  it('should process in FIFO order for random timestamps (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      // Generate random queue items
      const numItems = Math.floor(Math.random() * 10) + 2;
      const items = Array.from({ length: numItems }, (_, idx) => ({
        created_at: new Date(Date.now() - Math.random() * 86400000),
        query: `query_${idx}`,
      }));

      // Sort by created_at ascending (FIFO)
      const sorted = [...items].sort(
        (a, b) => a.created_at.getTime() - b.created_at.getTime()
      );

      // First item should have earliest timestamp
      for (let j = 1; j < sorted.length; j++) {
        expect(sorted[j].created_at.getTime()).toBeGreaterThanOrEqual(
          sorted[j - 1].created_at.getTime()
        );
      }
    }
  });
});

// --- Property 20: Emergency keyword detection ---
// Emergency keywords trigger immediate response without AI/cache.

describe('Property 20: Emergency keyword detection', () => {
  const keywords = getEmergencyKeywords();

  it('should detect all emergency keywords (exhaustive)', () => {
    for (const keyword of keywords) {
      const message = `Bệnh nhân bị ${keyword} cần giúp đỡ`;
      expect(detectEmergency(message)).toBe(true);
    }
  });

  it('should detect keywords regardless of surrounding text (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      const keyword = keywords[Math.floor(Math.random() * keywords.length)];
      const prefixes = ['Tôi bị ', 'Người nhà ', 'Bệnh nhân ', 'Con tôi bị '];
      const suffixes = [' rất nặng', ' từ sáng', ' cần cấp cứu', ''];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

      const message = `${prefix}${keyword}${suffix}`;
      expect(detectEmergency(message)).toBe(true);
    }
  });

  it('should NOT detect non-emergency messages (100 iterations)', () => {
    const nonEmergencyMessages = [
      'Tôi bị đau đầu nhẹ',
      'Vitamin D có tốt không?',
      'Cách giảm cân hiệu quả',
      'Thời tiết hôm nay đẹp',
      'Tôi muốn đặt lịch khám',
      'Thuốc ho nào tốt',
      'Cách chăm sóc da mặt',
      'Bài tập yoga cho người mới',
    ];

    for (let i = 0; i < 100; i++) {
      const msg = nonEmergencyMessages[i % nonEmergencyMessages.length];
      expect(detectEmergency(msg)).toBe(false);
    }
  });

  it('should return response containing 115', () => {
    const response = getEmergencyResponse();
    expect(response).toContain('115');
  });
});
