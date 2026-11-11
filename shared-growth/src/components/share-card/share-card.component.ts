/**
 * Share Card Component
 * Tasks: GRW-017, GRW-018, GRW-019
 * 
 * Creates shareable image cards for:
 * - Price drops (SmartBuy)
 * - Tax calculations (FinTax)
 * - DTC codes (DoctorCar)
 * - Health/Drug info (CareMate)
 * - News articles (TrendBrief)
 * 
 * Includes download as image and social sharing
 */
import { Component, Input, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocialShareButtonsComponent, ShareContent, SharePlatform } from '../social-share-buttons/social-share-buttons.component';

export type ShareCardVariant = 'price-drop' | 'result' | 'news' | 'tax' | 'dtc' | 'health';

export interface ShareCardData {
  // Common
  title: string;
  description?: string;
  imageUrl?: string;
  timestamp?: Date | string;
  appName?: string;
  appLogo?: string;
  tagline?: string;
  shareUrl?: string;

  // Price Drop (SmartBuy)
  originalPrice?: number;
  currentPrice?: number;
  discountPercent?: number;
  savings?: number;
  platform?: string;  // Shopee, Lazada, Tiki

  // Result Card
  icon?: string;
  headerColor?: string;
  mainLabel?: string;
  mainValue?: string;
  details?: Array<{ label: string; value: string }>;

  // News (TrendBrief)
  category?: string;
  source?: string;
  summary?: string;
  isBreaking?: boolean;

  // Tax (FinTax)
  taxAmount?: number;
  grossIncome?: number;
  personalDeduction?: number;
  dependentDeduction?: number;
  netIncome?: number;

  // DTC (DoctorCar)
  dtcCode?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  affectedModels?: string[];

  // Health (CareMate)
  drugName?: string;
  genericName?: string;
  prices?: Array<{ pharmacy: string; price: number }>;
}

@Component({
  selector: 'app-share-card',
  standalone: true,
  imports: [CommonModule, SocialShareButtonsComponent],
  templateUrl: './share-card.component.html',
  styleUrls: ['./share-card.component.scss']
})
export class ShareCardComponent implements OnInit {
  @Input() variant: ShareCardVariant = 'result';
  @Input() data!: ShareCardData;
  @Input() compact = false;
  @Input() showWatermark = true;
  @Input() showActions = true;

  @ViewChild('cardElement', { static: false }) cardElement!: ElementRef<HTMLDivElement>;

  shareContent!: ShareContent;
  sharePlatforms: SharePlatform[] = ['zalo', 'facebook', 'telegram', 'copy'];

  // Vietnamese currency formatter
  private currencyFormatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  });

  // Relative time formatter
  private relativeTimeFormatter = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

  ngOnInit(): void {
    this.initShareContent();
  }

  private initShareContent(): void {
    const url = this.data.shareUrl || window.location.href;
    
    this.shareContent = {
      title: this.getShareTitle(),
      description: this.getShareDescription(),
      url: url,
      imageUrl: this.data.imageUrl,
      hashtags: this.getHashtags()
    };
  }

  private getShareTitle(): string {
    switch (this.variant) {
      case 'price-drop':
        return `🔥 GIẢM ${this.data.discountPercent}%: ${this.data.title}`;
      case 'tax':
        return `💰 Thuế TNCN: ${this.formatPrice(this.data.taxAmount)}/tháng`;
      case 'dtc':
        return `🚗 Mã lỗi ${this.data.dtcCode}: ${this.data.title}`;
      case 'health':
        return `💊 ${this.data.drugName || this.data.title}`;
      case 'news':
        return this.data.isBreaking ? `🔴 ${this.data.title}` : this.data.title;
      default:
        return this.data.title;
    }
  }

  private getShareDescription(): string {
    switch (this.variant) {
      case 'price-drop':
        return `Giá chỉ ${this.formatPrice(this.data.currentPrice)} (tiết kiệm ${this.formatPrice(this.data.savings)}) trên ${this.data.platform}`;
      case 'tax':
        return `Thu nhập ${this.formatPrice(this.data.grossIncome)} → Thuế ${this.formatPrice(this.data.taxAmount)} → Thực nhận ${this.formatPrice(this.data.netIncome)}`;
      case 'dtc':
        return this.data.description || '';
      case 'health':
        return this.data.description || '';
      default:
        return this.data.description || this.data.summary || '';
    }
  }

  private getHashtags(): string[] {
    const baseHashtags = ['AIAppsVN'];
    
    switch (this.variant) {
      case 'price-drop':
        return [...baseHashtags, 'SmartBuy', 'GiamGia', 'FlashSale', this.data.platform || ''];
      case 'tax':
        return [...baseHashtags, 'FinTax', 'ThueTNCN', 'TaiChinhCaNhan'];
      case 'dtc':
        return [...baseHashtags, 'DoctorCar', 'MaLoiOto', 'SuaChuaXe'];
      case 'health':
        return [...baseHashtags, 'CareMate', 'SucKhoe', 'ThuocTay'];
      case 'news':
        return [...baseHashtags, 'TrendBrief', 'TinTuc', this.data.category || ''];
      default:
        return baseHashtags;
    }
  }

  formatPrice(value: number | undefined): string {
    if (value === undefined || value === null) return '';
    return this.currencyFormatter.format(value);
  }

  formatTime(timestamp: Date | string | undefined): string {
    if (!timestamp) return '';
    
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return this.relativeTimeFormatter.format(-diffMins, 'minute');
    } else if (diffHours < 24) {
      return this.relativeTimeFormatter.format(-diffHours, 'hour');
    } else if (diffDays < 7) {
      return this.relativeTimeFormatter.format(-diffDays, 'day');
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  }

  getPlatformLogo(platform: string | undefined): string {
    const logos: Record<string, string> = {
      'Shopee': 'assets/platforms/shopee.png',
      'Lazada': 'assets/platforms/lazada.png',
      'Tiki': 'assets/platforms/tiki.png',
      'Sendo': 'assets/platforms/sendo.png'
    };
    return logos[platform || ''] || 'assets/platforms/default.png';
  }

  getSeverityIcon(severity: string | undefined): string {
    const icons: Record<string, string> = {
      'low': 'fas fa-check-circle',
      'medium': 'fas fa-exclamation-circle',
      'high': 'fas fa-exclamation-triangle',
      'critical': 'fas fa-times-circle'
    };
    return icons[severity || 'low'] || 'fas fa-info-circle';
  }

  getSeverityLabel(severity: string | undefined): string {
    const labels: Record<string, string> = {
      'low': 'Mức độ thấp',
      'medium': 'Mức độ trung bình',
      'high': 'Mức độ cao',
      'critical': 'Nghiêm trọng'
    };
    return labels[severity || 'low'] || 'Không xác định';
  }

  async downloadAsImage(): Promise<void> {
    if (!this.cardElement?.nativeElement) return;

    try {
      // Dynamic import html2canvas for smaller bundle
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(this.cardElement.nativeElement, {
        scale: 2,  // High resolution
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });

      // Create download link
      const link = document.createElement('a');
      const filename = this.generateFilename();
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Track download
      window.dispatchEvent(new CustomEvent('growth:share', {
        detail: {
          event: 'card_download',
          variant: this.variant,
          title: this.data.title,
          timestamp: new Date().toISOString()
        }
      }));

    } catch (error) {
      console.error('[ShareCard] Download failed:', error);
      // Fallback: alert user
      alert('Không thể tải ảnh. Vui lòng thử lại.');
    }
  }

  private generateFilename(): string {
    const appNames: Record<ShareCardVariant, string> = {
      'price-drop': 'SmartBuy',
      'result': 'Result',
      'news': 'TrendBrief',
      'tax': 'FinTax',
      'dtc': 'DoctorCar',
      'health': 'CareMate'
    };

    const app = appNames[this.variant] || 'Share';
    const timestamp = new Date().toISOString().slice(0, 10);
    const slug = this.data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .slice(0, 30);

    return `${app}-${slug}-${timestamp}.png`;
  }
}
