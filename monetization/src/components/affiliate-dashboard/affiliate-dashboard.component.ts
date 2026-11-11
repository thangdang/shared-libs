// MON-021: Affiliate Dashboard (Admin)
// Dashboard for tracking affiliate performance across all apps

import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Services
import { AffiliateService } from '../../services/affiliate.service';

interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  avgOrderValue: number;
  pendingCommission: number;
  paidCommission: number;
}

interface PlatformStats {
  platform: 'shopee' | 'lazada' | 'tiki';
  clicks: number;
  conversions: number;
  revenue: number;
  commission: number;
  conversionRate: number;
}

interface TopProduct {
  productId: string;
  name: string;
  platform: string;
  clicks: number;
  conversions: number;
  revenue: number;
  commission: number;
  imageUrl?: string;
}

interface DailyStats {
  date: string;
  clicks: number;
  conversions: number;
  revenue: number;
}

interface DateRange {
  id: string;
  label: string;
  days: number;
}

@Component({
  selector: 'app-affiliate-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-dashboard.component.html',
  styleUrl: './affiliate-dashboard.component.scss'
})
export class AffiliateDashboardComponent implements OnInit {
  private affiliateService = inject(AffiliateService);

  // Data signals
  stats = signal<AffiliateStats>({
    totalClicks: 0,
    totalConversions: 0,
    totalRevenue: 0,
    conversionRate: 0,
    avgOrderValue: 0,
    pendingCommission: 0,
    paidCommission: 0
  });

  platformStats = signal<PlatformStats[]>([]);
  topProducts = signal<TopProduct[]>([]);
  dailyStats = signal<DailyStats[]>([]);

  // Change percentages (vs previous period)
  clicksChange = signal(0);
  conversionsChange = signal(0);
  revenueChange = signal(0);

  // UI State
  loading = signal(true);
  selectedRange = '7d';

  dateRanges: DateRange[] = [
    { id: '7d', label: 'Last 7 Days', days: 7 },
    { id: '30d', label: 'Last 30 Days', days: 30 },
    { id: '90d', label: 'Last 90 Days', days: 90 },
    { id: 'mtd', label: 'Month to Date', days: 0 },
    { id: 'ytd', label: 'Year to Date', days: 0 }
  ];

  private maxClicks = 0;
  private maxRevenue = 0;

  ngOnInit(): void {
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    this.loading.set(true);

    try {
      const range = this.getDateRange();
      const [stats, platforms, products, daily] = await Promise.all([
        this.affiliateService.getStats(range.start, range.end),
        this.affiliateService.getPlatformStats(range.start, range.end),
        this.affiliateService.getTopProducts(range.start, range.end, 10),
        this.affiliateService.getDailyStats(range.start, range.end)
      ]);

      this.stats.set(stats);
      this.platformStats.set(platforms);
      this.topProducts.set(products);
      this.dailyStats.set(daily);

      // Calculate max values for chart
      this.maxClicks = Math.max(...daily.map(d => d.clicks), 1);
      this.maxRevenue = Math.max(...daily.map(d => d.revenue), 1);

      // Load comparison stats
      await this.loadChangeStats(range);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadChangeStats(currentRange: { start: Date; end: Date }): Promise<void> {
    try {
      const days = Math.ceil((currentRange.end.getTime() - currentRange.start.getTime()) / (1000 * 60 * 60 * 24));
      const previousStart = new Date(currentRange.start.getTime() - days * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(currentRange.start.getTime() - 1);

      const previousStats = await this.affiliateService.getStats(previousStart, previousEnd);

      this.clicksChange.set(this.calculateChange(this.stats().totalClicks, previousStats.totalClicks));
      this.conversionsChange.set(this.calculateChange(this.stats().totalConversions, previousStats.totalConversions));
      this.revenueChange.set(this.calculateChange(this.stats().totalRevenue, previousStats.totalRevenue));
    } catch (error) {
      console.error('Failed to load comparison stats:', error);
    }
  }

  private calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private getDateRange(): { start: Date; end: Date } {
    const end = new Date();
    let start: Date;

    switch (this.selectedRange) {
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'mtd':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        break;
      case 'ytd':
        start = new Date(end.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  onRangeChange(): void {
    this.loadDashboardData();
  }

  refresh(): void {
    this.loadDashboardData();
  }

  exportReport(): void {
    // Export functionality
    console.log('Exporting report...');
  }

  getPlatformName(platform: string): string {
    const names: Record<string, string> = {
      shopee: 'Shopee',
      lazada: 'Lazada',
      tiki: 'Tiki'
    };
    return names[platform] || platform;
  }

  getBarHeight(value: number, type: 'clicks' | 'revenue'): number {
    const max = type === 'clicks' ? this.maxClicks : this.maxRevenue;
    return Math.max(5, (value / max) * 100);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }
}
