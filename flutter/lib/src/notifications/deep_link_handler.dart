import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

/// Deep Link Handler (MT18-MT19 — MREQ-16)
///
/// Routes notification deep links to correct screen via GoRouter or Navigator.
/// Handles all 3 app states: foreground, background, terminated.
///
/// Usage:
///   // In main.dart after Firebase.initializeApp():
///   final deepLinkHandler = DeepLinkHandler(navigatorKey: navigatorKey, routeMap: {...});
///   await deepLinkHandler.initialize();
class DeepLinkHandler {
  final GlobalKey<NavigatorState> navigatorKey;
  final Map<String, String> routeMap;

  /// Callback for GoRouter-based navigation (preferred over Navigator).
  /// If provided, this is called instead of Navigator.pushNamed.
  /// Signature: (String fullPath) → void
  final void Function(String)? goRouterNavigate;

  /// Callback for analytics tracking when notification is opened.
  final void Function(String route, Map<String, dynamic> data)? onNotificationOpened;

  DeepLinkHandler({
    required this.navigatorKey,
    required this.routeMap,
    this.goRouterNavigate,
    this.onNotificationOpened,
  });

  /// Initialize FCM message handling for all 3 app states.
  /// Call this once in main() after Firebase.initializeApp().
  Future<void> initialize() async {
    // ─── State 1: App terminated → user taps notification ───
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _handleMessage(initialMessage);
    }

    // ─── State 2: App in background → user taps notification ───
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessage);

    // ─── State 3: App in foreground → show in-app banner ───
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
  }

  /// Handle a deep link path from notification data payload.
  void handle(String? deepLink) {
    if (deepLink == null || deepLink.isEmpty) return;

    // Try GoRouter first (preferred)
    if (goRouterNavigate != null) {
      goRouterNavigate!(deepLink);
      return;
    }

    // Fallback to Navigator
    final navigator = navigatorKey.currentState;
    if (navigator == null) return;

    final uri = Uri.parse(deepLink);
    final segments = uri.pathSegments;

    if (segments.isEmpty) {
      navigator.pushNamedAndRemoveUntil('/', (route) => false);
      return;
    }

    final basePath = '/${segments.first}';
    final targetRoute = routeMap[basePath];

    if (targetRoute != null) {
      final args = segments.length > 1 ? segments.sublist(1).join('/') : null;
      navigator.pushNamed(targetRoute, arguments: args);
    } else {
      navigator.pushNamedAndRemoveUntil('/', (route) => false);
    }
  }

  /// Extract deep link route from FCM message data payload.
  String? _extractRoute(RemoteMessage message) {
    // Check data payload for route (standard format)
    return message.data['route'] ?? message.data['deep_link'] ?? message.data['link'];
  }

  /// Handle notification tap (background + terminated states).
  void _handleMessage(RemoteMessage message) {
    final route = _extractRoute(message);

    // Track analytics
    onNotificationOpened?.call(
      route ?? '/',
      message.data.cast<String, dynamic>(),
    );

    handle(route);
  }

  /// Handle foreground message — show in-app notification.
  void _handleForegroundMessage(RemoteMessage message) {
    final context = navigatorKey.currentContext;
    if (context == null) return;

    final notification = message.notification;
    if (notification == null) return;

    // Show SnackBar as in-app notification
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              notification.title ?? '',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            if (notification.body != null)
              Text(
                notification.body!,
                style: const TextStyle(fontSize: 12),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
        action: SnackBarAction(
          label: 'Xem',
          onPressed: () => _handleMessage(message),
        ),
        duration: const Duration(seconds: 5),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}
