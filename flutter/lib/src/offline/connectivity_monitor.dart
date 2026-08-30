import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Connectivity Monitor — Tracks online/offline state.
/// Shows banner when offline, syncs pending actions when back online.
class ConnectivityMonitor {
  final Connectivity _connectivity = Connectivity();
  StreamSubscription? _subscription;
  bool _isOnline = true;
  final Function(bool isOnline)? onStatusChange;

  ConnectivityMonitor({this.onStatusChange});

  bool get isOnline => _isOnline;

  /// Start monitoring connectivity.
  void start() {
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      final wasOnline = _isOnline;
      _isOnline = !results.contains(ConnectivityResult.none);

      if (wasOnline != _isOnline) {
        onStatusChange?.call(_isOnline);
      }
    });

    // Check initial state
    _connectivity.checkConnectivity().then((results) {
      _isOnline = !results.contains(ConnectivityResult.none);
    });
  }

  /// Stop monitoring.
  void stop() {
    _subscription?.cancel();
  }
}
