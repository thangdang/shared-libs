/**
 * Unit tests for CareMate emergency detection.
 */

import {
  detectEmergency,
  getEmergencyResponse,
  getEmergencyKeywords,
} from '../services/emergencyDetector';

describe('detectEmergency', () => {
  it('should detect "đau ngực" as emergency', () => {
    expect(detectEmergency('Tôi bị đau ngực rất nhiều')).toBe(true);
  });

  it('should detect "khó thở" as emergency', () => {
    expect(detectEmergency('Bệnh nhân khó thở')).toBe(true);
  });

  it('should detect "chảy máu nhiều" as emergency', () => {
    expect(detectEmergency('Đang chảy máu nhiều không cầm được')).toBe(true);
  });

  it('should detect "bất tỉnh" as emergency', () => {
    expect(detectEmergency('Người nhà bất tỉnh')).toBe(true);
  });

  it('should detect "co giật" as emergency', () => {
    expect(detectEmergency('Trẻ em bị co giật')).toBe(true);
  });

  it('should detect "đột quỵ" as emergency', () => {
    expect(detectEmergency('Nghi ngờ đột quỵ')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(detectEmergency('ĐAU NGỰC rất đau')).toBe(true);
  });

  it('should return false for non-emergency messages', () => {
    expect(detectEmergency('Tôi bị đau đầu nhẹ')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(detectEmergency('')).toBe(false);
  });

  it('should return false for general health questions', () => {
    expect(detectEmergency('Vitamin D có tốt không?')).toBe(false);
  });
});

describe('getEmergencyResponse', () => {
  it('should contain 115 emergency number', () => {
    const response = getEmergencyResponse();
    expect(response).toContain('115');
  });

  it('should contain warning indicator', () => {
    const response = getEmergencyResponse();
    expect(response).toContain('CẢNH BÁO');
  });

  it('should be a non-empty string', () => {
    const response = getEmergencyResponse();
    expect(response.length).toBeGreaterThan(0);
  });
});

describe('getEmergencyKeywords', () => {
  it('should return an array of keywords', () => {
    const keywords = getEmergencyKeywords();
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThan(10);
  });

  it('should include core emergency keywords', () => {
    const keywords = getEmergencyKeywords();
    expect(keywords).toContain('đau ngực');
    expect(keywords).toContain('khó thở');
    expect(keywords).toContain('bất tỉnh');
    expect(keywords).toContain('đột quỵ');
  });
});
