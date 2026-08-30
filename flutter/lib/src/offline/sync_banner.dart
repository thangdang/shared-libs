/// Offline / Sync Status Banner Widget (MT21 — MREQ-7)
///
/// Displays connectivity status to the user:
///   - Online: hidden (or shows "Đã cập nhật lúc 14:30")
///   - Offline: shows orange "Đang offline — hiển thị dữ liệu đã lưu"
///   - Syncing: shows blue "Đang đồng bộ..."
///
/// Usage:
///   // Wrap your Scaffold body:
///   Column(children: [
///     const SyncBanner(),
///     Expanded(child: yourContent),
///   ])
///
///   // Or use SyncBannerScaffold for convenience:
///   SyncBannerScaffold(
///     appBar: AppBar(title: Text('Home')),
///     body: YourContent(),
///   )
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Displays offline/sync status at the top of the screen.
class SyncBanner extends StatefulWidget {
  /// Text shown when offline.
  final String offlineText;

  /// Text shown while syncing pending data.
  final String syncingText;

  /// Whether to show "last updated" timestamp when online.
  final bool showLastUpdated;

  /// Timestamp of last successful data fetch.
  final DateTime? lastUpdatedAt;

  /// Number of items pending sync.
  final int pendingSyncCount;

  const SyncBanner({
    super.key,
    this.offlineText = 'Đang offline — hiển thị dữ liệu đã lưu',
    this.syncingText = 'Đang đồng bộ...',
    this.showLastUpdated = false,
    this.lastUpdatedAt,
    this.pendingSyncCount = 0,
  });

  @override
  State<SyncBanner> createState() => _SyncBannerState();
}

class _SyncBannerState extends State<SyncBanner> with SingleTickerProviderStateMixin {
  bool _isOffline = false;
  late StreamSubscription<List<ConnectivityResult>> _subscription;
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    // Listen to connectivity changes
    _subscription = Connectivity().onConnectivityChanged.listen((results) {
      final offline = results.contains(ConnectivityResult.none);
      if (offline != _isOffline) {
        setState(() => _isOffline = offline);
        if (offline) {
          _animController.forward();
        } else {
          _animController.reverse();
        }
      }
    });

    // Check initial state
    Connectivity().checkConnectivity().then((results) {
      if (mounted) {
        setState(() => _isOffline = results.contains(ConnectivityResult.none));
        if (_isOffline) _animController.forward();
      }
    });
  }

  @override
  void dispose() {
    _subscription.cancel();
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Syncing state (online but pending items)
    if (!_isOffline && widget.pendingSyncCount > 0) {
      return _buildBanner(
        text: '${widget.syncingText} (${widget.pendingSyncCount})',
        color: const Color(0xFF3B82F6),
        icon: Icons.sync,
      );
    }

    // Offline state
    if (_isOffline) {
      return _buildBanner(
        text: widget.offlineText,
        color: const Color(0xFFF59E0B),
        icon: Icons.cloud_off,
      );
    }

    // Online + show last updated
    if (widget.showLastUpdated && widget.lastUpdatedAt != null) {
      final time = _formatTime(widget.lastUpdatedAt!);
      return _buildBanner(
        text: 'Đã cập nhật lúc $time',
        color: const Color(0xFF10B981),
        icon: Icons.check_circle_outline,
        compact: true,
      );
    }

    // Online, nothing to show
    return const SizedBox.shrink();
  }

  Widget _buildBanner({
    required String text,
    required Color color,
    required IconData icon,
    bool compact = false,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: EdgeInsets.symmetric(
        horizontal: 16,
        vertical: compact ? 4 : 8,
      ),
      color: color.withOpacity(0.1),
      child: Row(
        children: [
          Icon(icon, size: compact ? 14 : 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: compact ? 11 : 12,
                color: color,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

/// Convenience Scaffold wrapper that includes SyncBanner at the top.
class SyncBannerScaffold extends StatelessWidget {
  final PreferredSizeWidget? appBar;
  final Widget body;
  final Widget? floatingActionButton;
  final Widget? bottomNavigationBar;
  final int pendingSyncCount;
  final DateTime? lastUpdatedAt;

  const SyncBannerScaffold({
    super.key,
    this.appBar,
    required this.body,
    this.floatingActionButton,
    this.bottomNavigationBar,
    this.pendingSyncCount = 0,
    this.lastUpdatedAt,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: appBar,
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomNavigationBar,
      body: Column(
        children: [
          SyncBanner(
            pendingSyncCount: pendingSyncCount,
            lastUpdatedAt: lastUpdatedAt,
            showLastUpdated: lastUpdatedAt != null,
          ),
          Expanded(child: body),
        ],
      ),
    );
  }
}
