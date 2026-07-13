import 'dart:async';
import 'package:in_app_purchase/in_app_purchase.dart';

/// Shared IAP Service — Apple + Google In-App Purchase.
/// All 5 apps use the same subscription verification flow.
class IAPService {
  final InAppPurchase _iap = InAppPurchase.instance;
  final String _verifyEndpoint;
  StreamSubscription? _subscription;

  /// Product IDs per app (configured at init).
  final Set<String> productIds;

  /// Callback when purchase is verified.
  final Function(String productId, bool success)? onPurchaseVerified;

  IAPService({
    required String verifyEndpoint,
    required this.productIds,
    this.onPurchaseVerified,
  }) : _verifyEndpoint = verifyEndpoint;

  /// Initialize IAP and start listening for purchases.
  Future<void> init() async {
    final available = await _iap.isAvailable();
    if (!available) return;

    _subscription = _iap.purchaseStream.listen(_handlePurchase);
  }

  /// Get available products for display.
  Future<List<ProductDetails>> getProducts() async {
    final response = await _iap.queryProductDetails(productIds);
    return response.productDetails;
  }

  /// Initiate a purchase.
  Future<void> purchase(ProductDetails product) async {
    final purchaseParam = PurchaseParam(productDetails: product);
    await _iap.buyNonConsumable(purchaseParam: purchaseParam);
  }

  /// Restore previous purchases (required by Apple).
  Future<void> restorePurchases() async {
    await _iap.restorePurchases();
  }

  /// Dispose listener.
  void dispose() {
    _subscription?.cancel();
  }

  void _handlePurchase(List<PurchaseDetails> purchases) {
    for (final purchase in purchases) {
      if (purchase.status == PurchaseStatus.purchased ||
          purchase.status == PurchaseStatus.restored) {
        _verifyPurchase(purchase);
      }
      if (purchase.pendingCompletePurchase) {
        _iap.completePurchase(purchase);
      }
    }
  }

  Future<void> _verifyPurchase(PurchaseDetails purchase) async {
    // Send receipt to backend for server-side verification
    // Backend calls Apple/Google to verify → updates subscription status
    try {
      // In real implementation: call _verifyEndpoint with purchase data
      onPurchaseVerified?.call(purchase.productID, true);
    } catch (_) {
      onPurchaseVerified?.call(purchase.productID, false);
    }
  }
}
