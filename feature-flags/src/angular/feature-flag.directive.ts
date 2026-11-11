/**
 * Angular Feature Flag Directive - Nov 2026 Release
 * 
 * Structural directive to show/hide elements based on feature flags.
 * 
 * Usage:
 * ```html
 * <!-- Show only if feature is enabled -->
 * <button *featureFlag="'SEARCH'">Search</button>
 * 
 * <!-- Hide completely if feature is disabled (AI features) -->
 * <div *featureFlag="'AI_CHAT'; hide: true">AI Chat</div>
 * 
 * <!-- Show alternative content if disabled -->
 * <ng-container *featureFlag="'SUMMARIZE_URL'; else: noSummarize">
 *   <button>Summarize</button>
 * </ng-container>
 * <ng-template #noSummarize>
 *   <a href="/news">Read full article</a>
 * </ng-template>
 * ```
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  OnInit,
  OnDestroy,
  inject,
  effect,
} from '@angular/core';
import { FeatureFlagService } from './feature-flag.service';

@Directive({
  selector: '[featureFlag]',
  standalone: true,
})
export class FeatureFlagDirective implements OnInit, OnDestroy {
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  /** Feature flag name to check */
  @Input({ required: true }) featureFlag!: string;

  /** Template to show if feature is disabled */
  @Input() featureFlagElse?: TemplateRef<unknown>;

  /** If true, completely hide (don't show else template) */
  @Input() featureFlagHide = false;

  /** Invert the condition (show if disabled) */
  @Input() featureFlagInvert = false;

  private hasView = false;
  private hasElseView = false;

  ngOnInit(): void {
    // Use effect to reactively update view when flags change
    effect(() => {
      this.updateView();
    });
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
  }

  private updateView(): void {
    const isEnabled = this.featureFlags.isEnabled(this.featureFlag);
    const shouldShow = this.featureFlagInvert ? !isEnabled : isEnabled;

    if (shouldShow) {
      // Show main template
      if (!this.hasView) {
        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
        this.hasElseView = false;
      }
    } else {
      // Feature is disabled
      this.viewContainer.clear();
      this.hasView = false;

      // Show else template (unless hide is true)
      if (!this.featureFlagHide && this.featureFlagElse && !this.hasElseView) {
        this.viewContainer.createEmbeddedView(this.featureFlagElse);
        this.hasElseView = true;
      } else {
        this.hasElseView = false;
      }
    }
  }
}

/**
 * Directive to hide element if AI is disabled globally
 * 
 * Usage:
 * ```html
 * <div *hideIfNoAI>AI-powered features here</div>
 * ```
 */
@Directive({
  selector: '[hideIfNoAI]',
  standalone: true,
})
export class HideIfNoAIDirective implements OnInit {
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  ngOnInit(): void {
    effect(() => {
      const isAIEnabled = this.featureFlags.isAIEnabled();
      this.viewContainer.clear();
      if (isAIEnabled) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    });
  }
}

/**
 * Directive to show element only if feature is disabled
 * Useful for showing alternatives
 * 
 * Usage:
 * ```html
 * <a *showIfDisabled="'AI_CHAT'" href="/faq">See FAQ instead</a>
 * ```
 */
@Directive({
  selector: '[showIfDisabled]',
  standalone: true,
})
export class ShowIfDisabledDirective implements OnInit {
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  @Input({ required: true }) showIfDisabled!: string;

  ngOnInit(): void {
    effect(() => {
      const isDisabled = this.featureFlags.isDisabled(this.showIfDisabled);
      this.viewContainer.clear();
      if (isDisabled) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    });
  }
}
