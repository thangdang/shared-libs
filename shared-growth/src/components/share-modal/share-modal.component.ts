import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ShareOptions {
  title: string;
  text: string;
  url: string;
  referralCode?: string;
  hashtags?: string[];
}

export type SharePlatform = 'facebook' | 'twitter' | 'linkedin' | 'zalo' | 'telegram' | 'whatsapp' | 'email' | 'copy';

@Component({
  selector: 'app-share-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './share-modal.component.html',
  styleUrls: ['./share-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() shareOptions: ShareOptions = {
    title: '',
    text: '',
    url: ''
  };
  @Input() showReferralCode = true;
  @Input() platforms: SharePlatform[] = ['facebook', 'zalo', 'telegram', 'twitter', 'email', 'copy'];

  @Output() closed = new EventEmitter<void>();
  @Output() shared = new EventEmitter<{ platform: SharePlatform; success: boolean }>();

  copied = false;
  copyTimeout: any;

  get shareUrl(): string {
    let url = this.shareOptions.url;
    if (this.shareOptions.referralCode) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}ref=${this.shareOptions.referralCode}`;
    }
    return url;
  }

  get shareText(): string {
    return this.shareOptions.text;
  }

  ngOnInit(): void {
    document.addEventListener('keydown', this.handleKeydown);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.handleKeydown);
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.isOpen) {
      this.close();
    }
  };

  close(): void {
    this.isOpen = false;
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close();
    }
  }

  async share(platform: SharePlatform): Promise<void> {
    let success = false;

    try {
      switch (platform) {
        case 'facebook':
          this.shareToFacebook();
          success = true;
          break;
        case 'twitter':
          this.shareToTwitter();
          success = true;
          break;
        case 'linkedin':
          this.shareToLinkedIn();
          success = true;
          break;
        case 'zalo':
          this.shareToZalo();
          success = true;
          break;
        case 'telegram':
          this.shareToTelegram();
          success = true;
          break;
        case 'whatsapp':
          this.shareToWhatsApp();
          success = true;
          break;
        case 'email':
          this.shareViaEmail();
          success = true;
          break;
        case 'copy':
          await this.copyToClipboard();
          success = true;
          break;
      }
    } catch (error) {
      console.error(`Share to ${platform} failed:`, error);
    }

    this.shared.emit({ platform, success });
  }

  private shareToFacebook(): void {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.shareUrl)}&quote=${encodeURIComponent(this.shareText)}`;
    this.openPopup(url, 'Facebook');
  }

  private shareToTwitter(): void {
    const hashtags = this.shareOptions.hashtags?.join(',') || '';
    const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(this.shareUrl)}&text=${encodeURIComponent(this.shareText)}${hashtags ? `&hashtags=${hashtags}` : ''}`;
    this.openPopup(url, 'Twitter');
  }

  private shareToLinkedIn(): void {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.shareUrl)}`;
    this.openPopup(url, 'LinkedIn');
  }

  private shareToZalo(): void {
    const url = `https://zalo.me/share?url=${encodeURIComponent(this.shareUrl)}&title=${encodeURIComponent(this.shareOptions.title)}&description=${encodeURIComponent(this.shareText)}`;
    this.openPopup(url, 'Zalo');
  }

  private shareToTelegram(): void {
    const url = `https://t.me/share/url?url=${encodeURIComponent(this.shareUrl)}&text=${encodeURIComponent(this.shareText)}`;
    this.openPopup(url, 'Telegram');
  }

  private shareToWhatsApp(): void {
    const url = `https://wa.me/?text=${encodeURIComponent(this.shareText + ' ' + this.shareUrl)}`;
    this.openPopup(url, 'WhatsApp');
  }

  private shareViaEmail(): void {
    const subject = encodeURIComponent(this.shareOptions.title);
    const body = encodeURIComponent(`${this.shareText}\n\n${this.shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  private async copyToClipboard(): Promise<void> {
    const textToCopy = this.showReferralCode && this.shareOptions.referralCode
      ? `${this.shareText}\n\n${this.shareUrl}`
      : this.shareUrl;

    await navigator.clipboard.writeText(textToCopy);
    this.copied = true;

    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }

    this.copyTimeout = setTimeout(() => {
      this.copied = false;
    }, 2000);
  }

  private openPopup(url: string, title: string): void {
    const width = 600;
    const height = 400;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    window.open(
      url,
      title,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );
  }

  getPlatformIcon(platform: SharePlatform): string {
    const icons: Record<SharePlatform, string> = {
      facebook: 'fab fa-facebook-f',
      twitter: 'fab fa-twitter',
      linkedin: 'fab fa-linkedin-in',
      zalo: 'fas fa-comment-dots',
      telegram: 'fab fa-telegram-plane',
      whatsapp: 'fab fa-whatsapp',
      email: 'fas fa-envelope',
      copy: this.copied ? 'fas fa-check' : 'fas fa-copy'
    };
    return icons[platform];
  }

  getPlatformName(platform: SharePlatform): string {
    const names: Record<SharePlatform, string> = {
      facebook: 'Facebook',
      twitter: 'Twitter',
      linkedin: 'LinkedIn',
      zalo: 'Zalo',
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      email: 'Email',
      copy: this.copied ? 'Đã sao chép!' : 'Sao chép link'
    };
    return names[platform];
  }

  getPlatformColor(platform: SharePlatform): string {
    const colors: Record<SharePlatform, string> = {
      facebook: '#1877f2',
      twitter: '#1da1f2',
      linkedin: '#0a66c2',
      zalo: '#0068ff',
      telegram: '#0088cc',
      whatsapp: '#25d366',
      email: '#ea4335',
      copy: '#6b7280'
    };
    return colors[platform];
  }
}
