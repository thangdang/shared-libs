import 'package:flutter/material.dart';

/// Deep Link Handler — Routes notification deep links to correct screen.
/// Each app registers its own route map.
class DeepLinkHandler {
  final GlobalKey<NavigatorState> navigatorKey;
  final Map<String, String> routeMap;

  /// routeMap example: { '/product': '/product-detail', '/article': '/article-detail' }
  DeepLinkHandler({required this.navigatorKey, required this.routeMap});

  /// Handle a deep link path from notification.
  void handle(String? deepLink) {
    if (deepLink == null || deepLink.isEmpty) return;

    final navigator = navigatorKey.currentState;
    if (navigator == null) return;

    // Parse deep link: "/product/abc123" → route "/product-detail", args "abc123"
    final uri = Uri.parse(deepLink);
    final segments = uri.pathSegments;

    if (segments.isEmpty) {
      navigator.pushNamedAndRemoveUntil('/', (route) => false);
      return;
    }

    // Find matching route
    final basePath = '/${segments.first}';
    final targetRoute = routeMap[basePath];

    if (targetRoute != null) {
      final args = segments.length > 1 ? segments.sublist(1).join('/') : null;
      navigator.pushNamed(targetRoute, arguments: args);
    } else {
      // Default: go home
      navigator.pushNamedAndRemoveUntil('/', (route) => false);
    }
  }
}
