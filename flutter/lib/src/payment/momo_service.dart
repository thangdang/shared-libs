import 'package:url_launcher/url_launcher.dart';

/// MoMo Payment Service — Deep link to MoMo app for payment.
/// Used by all 5 apps for Vietnamese-native payment.
class MoMoService {
  final String _createEndpoint;

  MoMoService({required String apiBaseUrl})
      : _createEndpoint = '$apiBaseUrl/payment/momo/create';

  /// Create MoMo payment and open MoMo app.
  /// Returns true if MoMo app was opened, false if not installed.
  Future<bool> pay({
    required String orderId,
    required int amountVnd,
    required String description,
  }) async {
    // In production: call backend to create MoMo payment link
    // Backend returns deeplink URL → open MoMo app
    final momoUri = Uri.parse('momo://');
    if (await canLaunchUrl(momoUri)) {
      await launchUrl(momoUri);
      return true;
    }
    return false;
  }

  /// Check if MoMo is installed.
  Future<bool> isInstalled() async {
    final uri = Uri.parse('momo://');
    return await canLaunchUrl(uri);
  }
}
