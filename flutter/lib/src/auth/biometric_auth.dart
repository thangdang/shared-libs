/// Biometric Authentication Service (MT47 — MREQ-18)
///
/// Fingerprint / Face ID quick unlock for sensitive apps (FIN Tax, CareMate).
/// Uses local_auth plugin for platform-native biometric prompt.
///
/// Usage:
///   final bio = BiometricAuth();
///   if (await bio.isAvailable()) {
///     final authenticated = await bio.authenticate(reason: 'Xác thực để xem dữ liệu');
///   }
import 'package:flutter/services.dart';

/// Biometric authentication wrapper.
/// Uses platform channels to call local_auth (must be added to app's pubspec).
class BiometricAuth {
  static const _channel = MethodChannel('winlux_core/biometric');

  /// Check if device supports biometric auth.
  Future<bool> isAvailable() async {
    try {
      final result = await _channel.invokeMethod<bool>('isAvailable');
      return result ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Check which biometric types are enrolled (fingerprint, face, iris).
  Future<List<String>> getAvailableBiometrics() async {
    try {
      final result = await _channel.invokeListMethod<String>('getAvailableBiometrics');
      return result ?? [];
    } catch (_) {
      return [];
    }
  }

  /// Authenticate using biometrics.
  ///
  /// [reason] — Vietnamese explanation shown to user (e.g., "Xác thực để mở khóa")
  /// Returns true if authentication succeeded.
  Future<bool> authenticate({
    String reason = 'Xác thực bằng vân tay hoặc Face ID',
  }) async {
    try {
      final result = await _channel.invokeMethod<bool>('authenticate', {
        'localizedReason': reason,
        'biometricOnly': true,
      });
      return result ?? false;
    } catch (_) {
      return false;
    }
  }
}

/// Mixin for screens that require biometric unlock.
/// Add to StatefulWidget State to auto-prompt on resume.
///
/// Usage:
///   class _MyScreenState extends State<MyScreen> with BiometricLockMixin {
///     @override
///     String get lockReason => 'Xác thực để xem giao dịch';
///   }
mixin BiometricLockMixin<T extends StatefulWidget> on State<T> {
  final BiometricAuth _bio = BiometricAuth();
  bool _isLocked = false;

  String get lockReason => 'Xác thực để tiếp tục';

  bool get isLocked => _isLocked;

  Future<void> checkAndLock() async {
    if (await _bio.isAvailable()) {
      _isLocked = true;
      if (mounted) setState(() {});

      final success = await _bio.authenticate(reason: lockReason);
      if (success) {
        _isLocked = false;
        if (mounted) setState(() {});
      }
    }
  }
}
