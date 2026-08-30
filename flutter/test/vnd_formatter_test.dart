import 'package:flutter_test/flutter_test.dart';
import 'package:winlux_core/src/utils/vnd_formatter.dart';

void main() {
  group('formatVND', () {
    test('formats standard amounts with dot separator', () {
      expect(formatVND(625000), '625.000₫');
      expect(formatVND(1000000), '1.000.000₫');
      expect(formatVND(25000), '25.000₫');
      expect(formatVND(500), '500₫');
    });

    test('handles zero as "Miễn phí"', () {
      expect(formatVND(0), 'Miễn phí');
    });

    test('handles negative amounts', () {
      expect(formatVND(-50000), '-50.000₫');
    });

    test('custom free text', () {
      expect(formatVND(0, freeText: 'Free'), 'Free');
    });

    test('custom suffix', () {
      expect(formatVND(100000, suffix: 'đ'), '100.000đ');
      expect(formatVND(100000, suffix: ' VND'), '100.000 VND');
    });

    group('compact mode', () {
      test('formats millions as "triệu"', () {
        expect(formatVND(1500000, compact: true), '1,5 triệu₫');
        expect(formatVND(2000000, compact: true), '2 triệu₫');
        expect(formatVND(25000000, compact: true), '25 triệu₫');
      });

      test('formats billions as "tỷ"', () {
        expect(formatVND(1000000000, compact: true), '1 tỷ₫');
        expect(formatVND(2500000000, compact: true), '2,5 tỷ₫');
      });

      test('keeps full format below 1M', () {
        expect(formatVND(625000, compact: true), '625.000₫');
        expect(formatVND(99000, compact: true), '99.000₫');
      });
    });
  });

  group('formatVNDRange', () {
    test('formats range correctly', () {
      expect(formatVNDRange(500000, 800000), '500.000 – 800.000₫');
    });

    test('same min max returns single value', () {
      expect(formatVNDRange(100000, 100000), '100.000₫');
    });
  });

  group('formatVNDChange', () {
    test('positive change shows +', () {
      expect(formatVNDChange(125000), '+125.000₫');
    });

    test('negative change shows -', () {
      expect(formatVNDChange(-50000), '-50.000₫');
    });

    test('zero shows 0', () {
      expect(formatVNDChange(0), '0₫');
    });
  });
}
