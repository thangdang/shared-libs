/**
 * Social Share Buttons Component
 * Task: GRW-016 - Add social sharing buttons
 * 
 * Provides sharing to Facebook, Zalo, Twitter, Telegram, Copy Link
 * Vietnamese market focused (Zalo priority)
 */
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ShareContent {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  hashtags?: string[];
}

export type SharePlatform = 'facebook' | 'zalo' | 'twitter' | 'telegram' | 'linkedin' | 'copy';

interface ShareButton {
  platform: SharePlatform;
  label: string;
  icon: string;
  color: string;
  hoverColor: string;
}

@Component({
  selector: 'app-social-share-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './social-share-buttons.component.html',
  styleUrls: ['./social-share-buttons.component.scss']
})
export class SocialShareButtonsComponent implements OnInit, OnDestroy {
  @Input() content!: ShareContent;
  @Input() platforms: SharePlatform[] = ['zalo', 'facebook', 'telegram', 'twitter', 'copy'];
  @Input() layout: 'horizontal' | 'vertical' | 'compact' = 'horizontal';
  @Input() showLabels = true;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() trackingSource = 'unknown';

  buttons: ShareButton[] = [];
  copied = false;
  private copyTimeout?: ReturnType<typeof setTimeout>;

  private readonly allButtons: ShareButton[] = [
    {
      platform: 'zalo',
      label: 'Zalo',
      icon: 'zalo',
      color: '#0068ff',
      hoverColor: '#0055cc'
    },
    {
      platform: 'facebook',
      label: 'Facebook',
      icon: 'facebook',
      color: '#1877f2',
      hoverColor: '#166fe5'
    },
    {
      platform: 'telegram',
      label: 'Telegram',
      icon: 'telegram',
      color: '#0088cc',
      hoverColor: '#006699'
    },
    {
      platform: 'twitter',
      label: 'Twitter',
      icon: 'twitter',
      color: '#1da1f2',
      hoverColor: '#0c85d0'
    },
    {
      platform: 'linkedin',
      label: 'LinkedIn',
      icon: 'linkedin',
      color: '#0a66c2',
      hoverColor: '#004182'
    },
    {
      platform: 'copy',
      label: 'Sao chép',
      icon: 'link',
      color: '#6c757d',
      hoverColor: '#5a6268'
    }
  ];

  ngOnInit(): void {
    this.buttons = this.allButtons.filter(b => this.platforms.includes(b.platform));
  }

  ngOnDestroy(): void {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }

  share(platform: SharePlatform): void {
    const shareUrl = this.buildShareUrl(platform);
    
    if (platform === 'copy') {
      this.copyToClipboard();
      return;
    }

    // Track share event
    this.trackShare(platform);

    // Open share URL
    const width = 600;
    const height = 400;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    window.open(
      shareUrl,
      `share_${platform}`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }

  private buildShareUrl(platform: SharePlatform): string {
    const { title, description, url, hashtags } = this.content;
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const encodedDesc = encodeURIComponent(description);
    const hashtagStr = hashtags?.map(h => h.replace('#', '')).join(',') || '';

    switch (platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`;

      case 'zalo':
        // Zalo uses OA Share API or simple share link
        return `https://zalo.me/share?url=${encodedUrl}&title=${encodedTitle}&description=${encodedDesc}`;

      case 'twitter':
        let twitterUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
        if (hashtagStr) {
          twitterUrl += `&hashtags=${hashtagStr}`;
        }
        return twitterUrl;

      case 'telegram':
        return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;

      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

      default:
        return url;
    }
  }

  private async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.content.url);
      this.copied = true;
      this.trackShare('copy');

      this.copyTimeout = setTimeout(() => {
        this.copied = false;
      }, 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = this.content.url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      this.copied = true;
      this.copyTimeout = setTimeout(() => {
        this.copied = false;
      }, 2000);
    }
  }

  private trackShare(platform: SharePlatform): void {
    // Analytics tracking - integrate with analytics.service
    const event = {
      event: 'social_share',
      platform,
      url: this.content.url,
      title: this.content.title,
      source: this.trackingSource,
      timestamp: new Date().toISOString()
    };

    // Dispatch custom event for analytics service to catch
    window.dispatchEvent(new CustomEvent('growth:share', { detail: event }));

    // Console log for debugging (remove in production)
    console.log('[SocialShare]', event);
  }

  getButtonStyle(button: ShareButton): Record<string, string> {
    return {
      '--btn-color': button.color,
      '--btn-hover': button.hoverColor
    } as Record<string, string>;
  }

  getIconClass(button: ShareButton): string {
    // Map to icon library (FontAwesome, Material Icons, or custom SVG)
    const iconMap: Record<string, string> = {
      facebook: 'fab fa-facebook-f',
      twitter: 'fab fa-twitter',
      telegram: 'fab fa-telegram-plane',
      linkedin: 'fab fa-linkedin-in',
      zalo: 'zalo-icon', // Custom Zalo icon
      link: 'fas fa-link'
    };
    return iconMap[button.icon] || 'fas fa-share';
  }
}
