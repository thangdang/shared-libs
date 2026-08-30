/// Zalo Share Button Widget (MT39 — MREQ-12)
///
/// "Chia sẻ qua Zalo" button for all mobile apps.
/// Uses Zalo deep link (zalo://share?url=...) with generic share_plus fallback.
///
/// Usage:
///   ZaloShareButton(
///     url: 'https://smartbuy.winlux.com/product/abc123',
///     title: 'iPhone 15 Pro — Giá tốt nhất',
///     description: 'So sánh giá từ 7 sàn TMĐT',
///   )
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';

/// Zalo Share Button — prominent blue button for Vietnamese users.
class ZaloShareButton extends StatelessWidget {
  /// URL to share.
  final String url;

  /// Content title (shown in Zalo share card).
  final String title;

  /// Optional description for the share card.
  final String? description;

  /// Compact mode (icon only, no text).
  final bool compact;

  /// Callback when share is triggered (for analytics).
  final VoidCallback? onShare;

  const ZaloShareButton({
    super.key,
    required this.url,
    required this.title,
    this.description,
    this.compact = false,
    this.onShare,
  });

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return IconButton(
        onPressed: () => _share(context),
        icon: const Icon(Icons.send_rounded),
        tooltip: 'Chia sẻ qua Zalo',
        style: IconButton.styleFrom(
          backgroundColor: const Color(0xFF0068FF),
          foregroundColor: Colors.white,
        ),
      );
    }

    return ElevatedButton.icon(
      onPressed: () => _share(context),
      icon: const Icon(Icons.send_rounded, size: 18),
      label: const Text('Chia sẻ qua Zalo'),
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF0068FF),
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
    );
  }

  Future<void> _share(BuildContext context) async {
    onShare?.call();

    // Strategy 1: Try Zalo deep link (opens Zalo app directly)
    final zaloUrl = Uri.parse(
      'https://zalo.me/share?url=${Uri.encodeComponent(url)}'
      '&title=${Uri.encodeComponent(title)}'
      '${description != null ? '&desc=${Uri.encodeComponent(description!)}' : ''}',
    );

    final canLaunch = await canLaunchUrl(zaloUrl);
    if (canLaunch) {
      await launchUrl(zaloUrl, mode: LaunchMode.externalApplication);
      return;
    }

    // Strategy 2: Fallback to generic share sheet
    await SharePlus.instance.share(
      ShareParams(
        text: '$title\n$url',
        subject: title,
      ),
    );
  }
}

/// Share action row with Zalo + generic share buttons.
/// Useful for product detail / article detail screens.
class ShareActionRow extends StatelessWidget {
  final String url;
  final String title;
  final String? description;
  final VoidCallback? onZaloShare;
  final VoidCallback? onGenericShare;

  const ShareActionRow({
    super.key,
    required this.url,
    required this.title,
    this.description,
    this.onZaloShare,
    this.onGenericShare,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: ZaloShareButton(
            url: url,
            title: title,
            description: description,
            onShare: onZaloShare,
          ),
        ),
        const SizedBox(width: 8),
        OutlinedButton.icon(
          onPressed: () async {
            onGenericShare?.call();
            await SharePlus.instance.share(
              ShareParams(text: '$title\n$url', subject: title),
            );
          },
          icon: const Icon(Icons.share_outlined, size: 18),
          label: const Text('Khác'),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            textStyle: const TextStyle(fontSize: 13),
          ),
        ),
      ],
    );
  }
}
