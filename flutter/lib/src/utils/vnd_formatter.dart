/// VND Currency Formatter (MT16 — MREQ-13)
///
/// Vietnamese Dong formatting utilities for all mobile apps.
/// Convention: dot thousand separator, ₫ suffix, compact mode for large amounts.
///
/// Usage:
///   import 'package:winlux_core/src/utils/vnd_formatter.dart';
///
///   formatVND(625000);           // "625.000₫"
///   formatVND(1500000, compact: true);  // "1,5 triệu₫"
///   formatVND(0);               // "Miễn phí"
library;

import 'package:intl/intl.dart';

/// Format a number as Vietnamese Dong.
///
/// - [amount]: Numeric value in VND
/// - [compact]: If true, uses shortened format (triệu, tỷ)
/// - [suffix]: Currency suffix (default: '₫')
/// - [freeText]: Text shown when amount is 0 (default: 'Miễn phí')
String formatVND(
  num amount, {
  bool compact = false,
  String suffix = '₫',
  String freeText = 'Miễn phí',
}) {
  if (amount == 0) return freeText;

  final isNegative = amount < 0;
  final absAmount = amount.abs();
  final sign = isNegative ? '-' : '';

  if (compact) {
    return '$sign${_formatCompact(absAmount, suffix)}';
  }

  return '$sign${_formatFull(absAmount, suffix)}';
}

/// Format price range: "625.000 – 890.000₫"
String formatVNDRange(num min, num max, {String suffix = '₫'}) {
  if (min == max) return formatVND(min);
  return '${_formatFull(min.abs(), '')} – ${_formatFull(max.abs(), suffix)}';
}

/// Format with explicit +/- sign for changes: "+125.000₫" or "-50.000₫"
String formatVNDChange(num amount, {String suffix = '₫'}) {
  if (amount == 0) return '0$suffix';
  final sign = amount > 0 ? '+' : '-';
  return '$sign${_formatFull(amount.abs(), suffix)}';
}

String _formatFull(num amount, String suffix) {
  // Vietnamese uses dot as thousand separator
  final formatter = NumberFormat('#,###', 'en_US');
  final formatted = formatter.format(amount.round()).replaceAll(',', '.');
  return '$formatted$suffix';
}

String _formatCompact(num amount, String suffix) {
  if (amount >= 1e9) {
    final val = amount / 1e9;
    return '${_decimalVi(val)} tỷ$suffix';
  }
  if (amount >= 1e6) {
    final val = amount / 1e6;
    return '${_decimalVi(val)} triệu$suffix';
  }
  // Below 1M — use full format
  return _formatFull(amount, suffix);
}

/// Format decimal with comma separator (Vietnamese convention: 1,5 not 1.5)
String _decimalVi(double val) {
  if (val == val.roundToDouble()) {
    return val.round().toString();
  }
  return val.toStringAsFixed(1).replaceAll('.', ',');
}
