/// SePay/VietQR Service — Bank transfer via QR code (webview).
/// Used for users without MoMo or credit card.
class SePayService {
  final String _createEndpoint;

  SePayService({required String apiBaseUrl})
      : _createEndpoint = '$apiBaseUrl/payment/sepay/create';

  /// Create SePay payment URL (opens in webview).
  /// User scans VietQR → bank transfer → webhook confirms.
  Future<String?> createPaymentUrl({
    required String orderId,
    required int amountVnd,
    required String description,
  }) async {
    // In production: call backend → returns SePay webview URL
    // User opens URL in in-app browser → scans QR → pays via banking app
    // Backend receives webhook when payment confirmed
    return null; // Placeholder — backend provides URL
  }
}
