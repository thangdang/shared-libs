// MON-022: Shopee/Lazada/Tiki Affiliate API Integration
// Integrates with major Vietnamese e-commerce affiliate programs

import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

export interface AffiliateLink {
  originalUrl: string;
  affiliateUrl: string;
  platform: 'shopee' | 'lazada' | 'tiki';
  productId?: string;
  shortUrl?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ProductInfo {
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  imageUrl: string;
  shopName: string;
  rating: number;
  soldCount: number;
  category: string;
  commissionRate: number;
}

export interface ConversionEvent {
  orderId: string;
  productId: string;
  platform: string;
  orderAmount: number;
  commission: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  clickId: string;
  convertedAt: Date;
}

// Base interface for platform-specific services
interface PlatformAffiliateService {
  generateLink(productUrl: string): Promise<AffiliateLink>;
  getProductInfo(productId: string): Promise<ProductInfo>;
  getConversions(startDate: Date, endDate: Date): Promise<ConversionEvent[]>;
  validateUrl(url: string): boolean;
}

@Injectable()
export class ShopeeAffiliateService implements PlatformAffiliateService {
  private readonly apiBaseUrl = 'https://open-api.affiliate.shopee.vn';
  private appId: string;
  private appSecret: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.appId = this.configService.get<string>('SHOPEE_AFFILIATE_APP_ID', '');
    this.appSecret = this.configService.get<string>('SHOPEE_AFFILIATE_SECRET', '');
  }

  validateUrl(url: string): boolean {
    return /shopee\.vn/i.test(url);
  }

  async generateLink(productUrl: string): Promise<AffiliateLink> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(timestamp);

    const response = await firstValueFrom(
      this.httpService.post(`${this.apiBaseUrl}/v2/link/generate`, {
        app_id: this.appId,
        timestamp,
        sign: signature,
        urls: [productUrl],
        sub_id: 'smartbuy'  // Tracking sub-affiliate ID
      })
    );

    const result = response.data;
    
    if (result.code !== 0) {
      throw new Error(`Shopee API error: ${result.message}`);
    }

    const linkData = result.data.links[0];
    const productId = this.extractProductId(productUrl);

    return {
      originalUrl: productUrl,
      affiliateUrl: linkData.affiliate_link,
      platform: 'shopee',
      productId,
      shortUrl: linkData.short_link,
      createdAt: new Date(),
      expiresAt: linkData.expire_time ? new Date(linkData.expire_time * 1000) : undefined
    };
  }

  async getProductInfo(productId: string): Promise<ProductInfo> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(timestamp);

    const response = await firstValueFrom(
      this.httpService.post(`${this.apiBaseUrl}/v2/product/info`, {
        app_id: this.appId,
        timestamp,
        sign: signature,
        product_ids: [productId]
      })
    );

    const result = response.data;
    
    if (result.code !== 0) {
      throw new Error(`Shopee API error: ${result.message}`);
    }

    const product = result.data.products[0];

    return {
      productId: product.product_id,
      name: product.product_name,
      price: product.price / 100000,  // Shopee uses micro-units
      originalPrice: product.original_price ? product.original_price / 100000 : undefined,
      discount: product.discount,
      imageUrl: product.image_url,
      shopName: product.shop_name,
      rating: product.rating,
      soldCount: product.sold_count,
      category: product.category_name,
      commissionRate: product.commission_rate / 100
    };
  }

  async getConversions(startDate: Date, endDate: Date): Promise<ConversionEvent[]> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(timestamp);

    const response = await firstValueFrom(
      this.httpService.post(`${this.apiBaseUrl}/v2/order/list`, {
        app_id: this.appId,
        timestamp,
        sign: signature,
        start_time: Math.floor(startDate.getTime() / 1000),
        end_time: Math.floor(endDate.getTime() / 1000),
        page_size: 100
      })
    );

    const result = response.data;
    
    if (result.code !== 0) {
      throw new Error(`Shopee API error: ${result.message}`);
    }

    return result.data.orders.map((order: any) => ({
      orderId: order.order_id,
      productId: order.product_id,
      platform: 'shopee',
      orderAmount: order.order_amount / 100000,
      commission: order.commission / 100000,
      status: this.mapOrderStatus(order.status),
      clickId: order.click_id,
      convertedAt: new Date(order.create_time * 1000)
    }));
  }

  private generateSignature(timestamp: number): string {
    const payload = `${this.appId}${timestamp}`;
    return crypto
      .createHmac('sha256', this.appSecret)
      .update(payload)
      .digest('hex');
  }

  private extractProductId(url: string): string {
    // Extract product ID from Shopee URL
    const match = url.match(/i\.(\d+)\.(\d+)/);
    if (match) {
      return `${match[1]}.${match[2]}`;
    }
    return '';
  }

  private mapOrderStatus(status: number): ConversionEvent['status'] {
    const statusMap: Record<number, ConversionEvent['status']> = {
      0: 'pending',
      1: 'approved',
      2: 'rejected',
      3: 'paid'
    };
    return statusMap[status] || 'pending';
  }
}

@Injectable()
export class LazadaAffiliateService implements PlatformAffiliateService {
  private readonly apiBaseUrl = 'https://api.lazada.vn/rest';
  private appKey: string;
  private appSecret: string;
  private accessToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.appKey = this.configService.get<string>('LAZADA_AFFILIATE_APP_KEY', '');
    this.appSecret = this.configService.get<string>('LAZADA_AFFILIATE_SECRET', '');
    this.accessToken = this.configService.get<string>('LAZADA_AFFILIATE_TOKEN', '');
  }

  validateUrl(url: string): boolean {
    return /lazada\.vn/i.test(url);
  }

  async generateLink(productUrl: string): Promise<AffiliateLink> {
    const timestamp = new Date().toISOString();
    const params = {
      app_key: this.appKey,
      timestamp,
      sign_method: 'sha256',
      urls: productUrl,
      sub_affiliate_id: 'smartbuy'
    };

    const signature = this.generateSignature(params);

    const response = await firstValueFrom(
      this.httpService.get(`${this.apiBaseUrl}/affiliate/link/generate`, {
        params: {
          ...params,
          sign: signature,
          access_token: this.accessToken
        }
      })
    );

    const result = response.data;
    
    if (result.code !== '0') {
      throw new Error(`Lazada API error: ${result.message}`);
    }

    const linkData = result.data;
    const productId = this.extractProductId(productUrl);

    return {
      originalUrl: productUrl,
      affiliateUrl: linkData.affiliate_link,
      platform: 'lazada',
      productId,
      shortUrl: linkData.short_link,
      createdAt: new Date()
    };
  }

  async getProductInfo(productId: string): Promise<ProductInfo> {
    const timestamp = new Date().toISOString();
    const params = {
      app_key: this.appKey,
      timestamp,
      sign_method: 'sha256',
      product_ids: productId
    };

    const signature = this.generateSignature(params);

    const response = await firstValueFrom(
      this.httpService.get(`${this.apiBaseUrl}/affiliate/product/info`, {
        params: {
          ...params,
          sign: signature,
          access_token: this.accessToken
        }
      })
    );

    const result = response.data;
    
    if (result.code !== '0') {
      throw new Error(`Lazada API error: ${result.message}`);
    }

    const product = result.data.products[0];

    return {
      productId: product.item_id,
      name: product.name,
      price: product.price,
      originalPrice: product.original_price,
      discount: product.discount,
      imageUrl: product.image,
      shopName: product.seller_name,
      rating: product.rating,
      soldCount: product.sold,
      category: product.category,
      commissionRate: product.commission_rate / 100
    };
  }

  async getConversions(startDate: Date, endDate: Date): Promise<ConversionEvent[]> {
    const timestamp = new Date().toISOString();
    const params = {
      app_key: this.appKey,
      timestamp,
      sign_method: 'sha256',
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      page_size: '100'
    };

    const signature = this.generateSignature(params);

    const response = await firstValueFrom(
      this.httpService.get(`${this.apiBaseUrl}/affiliate/order/list`, {
        params: {
          ...params,
          sign: signature,
          access_token: this.accessToken
        }
      })
    );

    const result = response.data;
    
    if (result.code !== '0') {
      throw new Error(`Lazada API error: ${result.message}`);
    }

    return result.data.orders.map((order: any) => ({
      orderId: order.order_id,
      productId: order.item_id,
      platform: 'lazada',
      orderAmount: order.amount,
      commission: order.commission,
      status: this.mapOrderStatus(order.status),
      clickId: order.tracking_id,
      convertedAt: new Date(order.create_time)
    }));
  }

  private generateSignature(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    const payload = sortedKeys.map(key => `${key}${params[key]}`).join('');
    const signPayload = `${this.appSecret}${payload}${this.appSecret}`;
    
    return crypto
      .createHmac('sha256', this.appSecret)
      .update(signPayload)
      .digest('hex')
      .toUpperCase();
  }

  private extractProductId(url: string): string {
    const match = url.match(/\/products\/([^\/\?]+)/);
    return match ? match[1] : '';
  }

  private mapOrderStatus(status: string): ConversionEvent['status'] {
    const statusMap: Record<string, ConversionEvent['status']> = {
      'pending': 'pending',
      'approved': 'approved',
      'rejected': 'rejected',
      'paid': 'paid'
    };
    return statusMap[status] || 'pending';
  }
}

@Injectable()
export class TikiAffiliateService implements PlatformAffiliateService {
  private readonly apiBaseUrl = 'https://api.tiki.vn/affiliate';
  private apiKey: string;
  private secretKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.apiKey = this.configService.get<string>('TIKI_AFFILIATE_API_KEY', '');
    this.secretKey = this.configService.get<string>('TIKI_AFFILIATE_SECRET', '');
  }

  validateUrl(url: string): boolean {
    return /tiki\.vn/i.test(url);
  }

  async generateLink(productUrl: string): Promise<AffiliateLink> {
    const timestamp = Date.now();
    const signature = this.generateSignature(timestamp, productUrl);

    const response = await firstValueFrom(
      this.httpService.post(`${this.apiBaseUrl}/links/generate`, {
        url: productUrl,
        sub_id: 'smartbuy'
      }, {
        headers: {
          'X-API-Key': this.apiKey,
          'X-Timestamp': timestamp.toString(),
          'X-Signature': signature
        }
      })
    );

    const result = response.data;
    const productId = this.extractProductId(productUrl);

    return {
      originalUrl: productUrl,
      affiliateUrl: result.affiliate_url,
      platform: 'tiki',
      productId,
      shortUrl: result.short_url,
      createdAt: new Date()
    };
  }

  async getProductInfo(productId: string): Promise<ProductInfo> {
    const timestamp = Date.now();
    const signature = this.generateSignature(timestamp, productId);

    const response = await firstValueFrom(
      this.httpService.get(`${this.apiBaseUrl}/products/${productId}`, {
        headers: {
          'X-API-Key': this.apiKey,
          'X-Timestamp': timestamp.toString(),
          'X-Signature': signature
        }
      })
    );

    const product = response.data;

    return {
      productId: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.list_price,
      discount: product.discount_rate,
      imageUrl: product.thumbnail_url,
      shopName: product.seller?.name || 'Tiki',
      rating: product.rating_average,
      soldCount: product.quantity_sold?.value || 0,
      category: product.categories?.name || '',
      commissionRate: product.commission_rate / 100
    };
  }

  async getConversions(startDate: Date, endDate: Date): Promise<ConversionEvent[]> {
    const timestamp = Date.now();
    const signature = this.generateSignature(timestamp, `${startDate.toISOString()}_${endDate.toISOString()}`);

    const response = await firstValueFrom(
      this.httpService.get(`${this.apiBaseUrl}/orders`, {
        params: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
          limit: 100
        },
        headers: {
          'X-API-Key': this.apiKey,
          'X-Timestamp': timestamp.toString(),
          'X-Signature': signature
        }
      })
    );

    const result = response.data;

    return result.orders.map((order: any) => ({
      orderId: order.order_code,
      productId: order.product_id,
      platform: 'tiki',
      orderAmount: order.total_amount,
      commission: order.commission,
      status: this.mapOrderStatus(order.status),
      clickId: order.click_id,
      convertedAt: new Date(order.created_at)
    }));
  }

  private generateSignature(timestamp: number, payload: string): string {
    const signPayload = `${timestamp}${payload}`;
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(signPayload)
      .digest('hex');
  }

  private extractProductId(url: string): string {
    const match = url.match(/p(\d+)\.html/);
    return match ? match[1] : '';
  }

  private mapOrderStatus(status: string): ConversionEvent['status'] {
    const statusMap: Record<string, ConversionEvent['status']> = {
      'pending': 'pending',
      'completed': 'approved',
      'cancelled': 'rejected',
      'paid': 'paid'
    };
    return statusMap[status] || 'pending';
  }
}

// Unified Affiliate Service
@Injectable()
export class UnifiedAffiliateService {
  constructor(
    private readonly shopeeService: ShopeeAffiliateService,
    private readonly lazadaService: LazadaAffiliateService,
    private readonly tikiService: TikiAffiliateService
  ) {}

  async generateLink(productUrl: string): Promise<AffiliateLink> {
    const service = this.getServiceForUrl(productUrl);
    return service.generateLink(productUrl);
  }

  async getProductInfo(productUrl: string): Promise<ProductInfo> {
    const service = this.getServiceForUrl(productUrl);
    const productId = this.extractProductId(productUrl);
    return service.getProductInfo(productId);
  }

  async getAllConversions(startDate: Date, endDate: Date): Promise<ConversionEvent[]> {
    const [shopeeConversions, lazadaConversions, tikiConversions] = await Promise.all([
      this.shopeeService.getConversions(startDate, endDate),
      this.lazadaService.getConversions(startDate, endDate),
      this.tikiService.getConversions(startDate, endDate)
    ]);

    return [...shopeeConversions, ...lazadaConversions, ...tikiConversions]
      .sort((a, b) => b.convertedAt.getTime() - a.convertedAt.getTime());
  }

  detectPlatform(url: string): 'shopee' | 'lazada' | 'tiki' | null {
    if (this.shopeeService.validateUrl(url)) return 'shopee';
    if (this.lazadaService.validateUrl(url)) return 'lazada';
    if (this.tikiService.validateUrl(url)) return 'tiki';
    return null;
  }

  private getServiceForUrl(url: string): PlatformAffiliateService {
    if (this.shopeeService.validateUrl(url)) return this.shopeeService;
    if (this.lazadaService.validateUrl(url)) return this.lazadaService;
    if (this.tikiService.validateUrl(url)) return this.tikiService;
    throw new Error('Unsupported platform URL');
  }

  private extractProductId(url: string): string {
    // Platform-agnostic product ID extraction
    if (url.includes('shopee.vn')) {
      const match = url.match(/i\.(\d+)\.(\d+)/);
      return match ? `${match[1]}.${match[2]}` : '';
    }
    if (url.includes('lazada.vn')) {
      const match = url.match(/\/products\/([^\/\?]+)/);
      return match ? match[1] : '';
    }
    if (url.includes('tiki.vn')) {
      const match = url.match(/p(\d+)\.html/);
      return match ? match[1] : '';
    }
    return '';
  }
}
