/**
 * Affiliate Track Directive
 * Automatically converts regular links to affiliate tracked links
 */

import {
  Directive,
  Input,
  HostListener,
  ElementRef,
  OnInit,
  inject
} from '@angular/core';
import { AffiliateAngularService } from './affiliate.service';
import { AffiliatePlatform, AffiliateLink } from '../types';

@Directive({
  selector: 'a[libAffiliateTrack]',
  standalone: true
})
export class AffiliateTrackDirective implements OnInit {
  private el = inject(ElementRef);
  private affiliateService = inject(AffiliateAngularService);

  @Input() libAffiliateTrack: string | AffiliatePlatform | true = true;
  @Input() trackMetadata?: Record<string, unknown>;

  private originalUrl: string = '';
  private affiliateLink: AffiliateLink | null = null;

  ngOnInit(): void {
    const element = this.el.nativeElement as HTMLAnchorElement;
    this.originalUrl = element.href;

    // Check if URL is trackable
    const platform = this.affiliateService.detectPlatform(this.originalUrl);
    if (!platform) {
      return; // Not an affiliate-able URL
    }

    // Generate affiliate link
    this.affiliateService.generateLink({
      originalUrl: this.originalUrl,
      platform: typeof this.libAffiliateTrack === 'string' 
        ? (this.libAffiliateTrack as AffiliatePlatform)
        : platform,
      metadata: this.trackMetadata
    }).subscribe(link => {
      if (link) {
        this.affiliateLink = link;
        // Update the href to tracking URL
        element.href = this.affiliateService.getTrackingUrl(link.id);
      }
    });
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (this.affiliateLink) {
      this.affiliateService.trackClick(this.affiliateLink.id, {
        ...this.trackMetadata,
        elementText: (this.el.nativeElement as HTMLAnchorElement).textContent
      });
    }
  }
}
