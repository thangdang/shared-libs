/// WinLux Core — Shared Flutter package for all 5 mobile apps.
///
/// Provides: API client, auth, payment, notifications, offline cache,
/// connectivity monitoring, and common widgets.
///
/// Usage in pubspec.yaml:
/// ```yaml
/// dependencies:
///   winlux_core:
///     path: ../../shared-libs/flutter-core
/// ```
///
/// Then import:
/// ```dart
/// import 'package:winlux_core/winlux_core.dart';
/// ```
library winlux_core;

export 'src/api/api_client.dart';
export 'src/api/auth_interceptor.dart';
export 'src/auth/auth_service.dart';
export 'src/auth/sso_service.dart';
export 'src/payment/iap_service.dart';
export 'src/payment/momo_service.dart';
export 'src/payment/sepay_service.dart';
export 'src/notifications/notification_service.dart';
export 'src/notifications/deep_link_handler.dart';
export 'src/offline/cache_service.dart';
export 'src/offline/connectivity_monitor.dart';
export 'src/offline/sync_queue.dart';
export 'src/config/app_config.dart';
