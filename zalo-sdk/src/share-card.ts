/**
 * ZaloShareCard — Build rich share cards for Zalo sharing.
 * Used when users share content from any WinLux app to Zalo.
 */

import type { ZaloShareData } from './types.js';

export class ZaloShareCard {
  /**
   * Build a Zalo share URL with rich preview (image + title + description).
   * When shared in Zalo chat, shows as a rich card instead of plain link.
   */
  static buildShareUrl(data: ZaloShareData): string {
    // Zalo uses Open Graph meta tags for rich previews.
    // The URL itself should have proper og:title, og:image, og:description meta tags.
    // This helper builds the URL with tracking params.
    const params = new URLSearchParams({
      utm_source: 'zalo',
      utm_medium: 'share',
      utm_campaign: 'winlux',
    });
    const separator = data.url.includes('?') ? '&' : '?';
    return `${data.url}${separator}${params.toString()}`;
  }

  /**
   * Build Zalo Mini App share data object.
   * Used by Zalo Mini Apps to invoke native share sheet.
   */
  static buildMiniAppShare(data: ZaloShareData): object {
    return {
      title: data.title,
      description: data.description || '',
      thumbnail: data.imageUrl,
      path: data.url,
    };
  }

  /**
   * Build a share image card (for generating shareable image).
   * Returns metadata that the frontend uses to render a card image.
   */
  static buildImageCard(data: ZaloShareData & {
    price?: string;
    discount?: string;
    brandLogo?: string;
  }): object {
    return {
      type: 'image_card',
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      price: data.price,
      discount: data.discount,
      brandLogo: data.brandLogo,
      shareUrl: ZaloShareCard.buildShareUrl(data),
      buttonText: data.buttonText || 'Xem chi tiết',
    };
  }
}
