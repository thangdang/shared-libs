/**
 * MON-017:  Feature Gate UI Component
 * 
 * Displays locked/gated features with blur/lock overlay.
 * Shows upgrade prompt for non-premium users.
 */

import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export type GateMode = 'blur' | 'lock' | 'hide' | 'disabled';
export type RequiredTier = 'basic' | 'premium' | 'enterprise';

@Component({
  selector: 'app-feature-gate',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feature-gate.component.html',
  styleUrl: './feature-gate.component.scss'
})
export class FeatureGateComponent {
  @Input() hasAccess = false;
  @Input() mode: GateMode = 'blur';
  @Input() requiredTier: RequiredTier = 'premium';
  @Input() title?: string;
  @Input() description?: string;
  @Input() upgradeText?: string;
  @Input() tooltipText?: string;
  @Input() showDismiss = true;

  @Output() upgradeClick = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  getDefaultTitle(): string {
    const titles: Record<RequiredTier, string> = {
      basic: 'Tính năng gói Basic',
      premium: 'Tính năng Premium',
      enterprise: 'Tính năng Enterprise'
    };
    return titles[this.requiredTier];
  }

  getDefaultDescription(): string {
    const descriptions: Record<RequiredTier, string> = {
      basic: 'Nâng cấp lên gói Basic để sử dụng tính năng này.',
      premium: 'Đây là tính năng cao cấp.  Nâng cấp lên Premium để mở khóa.',
      enterprise: 'Tính năng dành cho doanh nghiệp.  Liên hệ để biết thêm chi tiết.'
    };
    return descriptions[this.requiredTier];
  }

  dismiss(): void {
    this.dismissed.emit();
  }
}

export default FeatureGateComponent;
