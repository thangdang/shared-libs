import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Shared Notification Service — FCM setup + local notifications.
/// All 5 apps use the same FCM initialization and deep link handling.
class WinluxNotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();
  final String productName;
  final Function(String? deepLink)? onDeepLink;

  WinluxNotificationService({
    required this.productName,
    this.onDeepLink,
  });

  /// Initialize FCM + local notifications.
  Future<void> init() async {
    // Request permission
    await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Initialize local notifications (for medication reminders, etc.)
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: _onLocalNotificationTap,
    );

    // Handle FCM messages
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_onMessageOpenedApp);

    // Check if app was opened from terminated state via notification
    final initialMessage = await _fcm.getInitialMessage();
    if (initialMessage != null) {
      _handleDeepLink(initialMessage.data);
    }
  }

  /// Get FCM token (for sending targeted push).
  Future<String?> getToken() async {
    return await _fcm.getToken();
  }

  /// Subscribe to a topic (e.g., 'breaking_news', 'flash_sale').
  Future<void> subscribeTopic(String topic) async {
    await _fcm.subscribeToTopic('${productName}_$topic');
  }

  /// Unsubscribe from topic.
  Future<void> unsubscribeTopic(String topic) async {
    await _fcm.unsubscribeFromTopic('${productName}_$topic');
  }

  /// Schedule a local notification (for reminders).
  Future<void> scheduleLocal({
    required int id,
    required String title,
    required String body,
    required DateTime scheduledTime,
    String? deepLink,
  }) async {
    // Use flutter_local_notifications zonedSchedule
    // Implementation depends on timezone setup
  }

  /// Cancel a scheduled local notification.
  Future<void> cancelLocal(int id) async {
    await _local.cancel(id);
  }

  void _onForegroundMessage(RemoteMessage message) {
    // Show local notification when app is in foreground
    _local.show(
      message.hashCode,
      message.notification?.title ?? '',
      message.notification?.body ?? '',
      const NotificationDetails(
        android: AndroidNotificationDetails('default', 'Default', importance: Importance.high),
        iOS: DarwinNotificationDetails(),
      ),
      payload: message.data['deep_link'],
    );
  }

  void _onMessageOpenedApp(RemoteMessage message) {
    _handleDeepLink(message.data);
  }

  void _onLocalNotificationTap(NotificationResponse response) {
    if (response.payload != null) {
      onDeepLink?.call(response.payload);
    }
  }

  void _handleDeepLink(Map<String, dynamic> data) {
    final deepLink = data['deep_link'] as String?;
    onDeepLink?.call(deepLink);
  }
}
