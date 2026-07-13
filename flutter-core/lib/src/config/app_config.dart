/// App Configuration — Per-product settings.
/// Each app creates an instance with its own values.
class AppConfig {
  final String productName;
  final String apiBaseUrl;
  final String authServiceUrl;
  final String paymentServiceUrl;
  final Set<String> iapProductIds;
  final Map<String, String> deepLinkRoutes;

  const AppConfig({
    required this.productName,
    required this.apiBaseUrl,
    this.authServiceUrl = 'http://localhost:4100',
    this.paymentServiceUrl = 'http://localhost:4101',
    this.iapProductIds = const {},
    this.deepLinkRoutes = const {},
  });

  /// SmartBuy configuration.
  static const smartbuy = AppConfig(
    productName: 'smartbuy',
    apiBaseUrl: 'https://smartbuy.winlux.com/api',
    iapProductIds: {'smartbuy_pro_monthly', 'smartbuy_pro_annual'},
    deepLinkRoutes: {'/product': '/product-detail', '/deal': '/flash-sale'},
  );

  /// TrendBrief configuration.
  static const trendbriefai = AppConfig(
    productName: 'trendbriefai',
    apiBaseUrl: 'https://trendbriefai.winlux.com/api',
    iapProductIds: {'trendbriefai_premium_monthly', 'trendbriefai_premium_annual'},
    deepLinkRoutes: {'/article': '/article-detail', '/audio': '/audio-briefing'},
  );

  /// CareMate configuration.
  static const caremate = AppConfig(
    productName: 'caremate',
    apiBaseUrl: 'https://caremate.winlux.com/api',
    iapProductIds: {'caremate_pro_monthly'},
    deepLinkRoutes: {'/symptom': '/symptom-check', '/drug': '/drug-detail'},
  );

  /// FIN Tax configuration.
  static const fintax = AppConfig(
    productName: 'fintax',
    apiBaseUrl: 'https://fintax.winlux.com/api',
    iapProductIds: {'fintax_pro_monthly', 'fintax_seller_pro_monthly'},
    deepLinkRoutes: {'/calculator': '/pit-calculator', '/chat': '/ai-chat'},
  );

  /// Doctor Car configuration.
  static const doctorcar = AppConfig(
    productName: 'doctorcar',
    apiBaseUrl: 'https://doctorcar.winlux.com/api',
    iapProductIds: {'doctorcar_basic', 'doctorcar_advanced', 'doctorcar_expert'},
    deepLinkRoutes: {'/diagnosis': '/diagnosis-detail', '/garage': '/garage-detail'},
  );
}
