/**
 * SHARED-003:  Angular UI Hide/Show Directive Based on Feature Flags
 * Structural directive to conditionally show/hide elements based on feature flags
 */

import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  OnInit,
  OnDestroy,
  inject,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FeatureFlagService } from '../services/feature-flag.service';

/**
 * *featureFlag directive - shows element only when feature is enabled
 * 
 * Usage:
 *   <div *featureFlag="'ai_chat'">AI Chat is enabled</div>
 *   <button *featureFlag="'premium_feature'; else disabledTpl">Premium</button>
 */
@Directive({
  selector: '[featureFlag]',
  standalone: true
})
export class FeatureFlagDirective implements OnInit, OnDestroy {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private featureService = inject(FeatureFlagService);
  private destroyRef = inject(DestroyRef);

  private featureName = '';
  private elseTemplate: TemplateRef<any> | null = null;
  private isShown = false;

  @Input()
  set featureFlag(featureName: string) {
    this.featureName = featureName;
    this.updateView();
  }

  @Input()
  set featureFlagElse(templateRef: TemplateRef<any> | null) {
    this.elseTemplate = templateRef;
    this.updateView();
  }

  ngOnInit(): void {
    // Subscribe to feature flag changes
    this.featureService.flagChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateView());
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
  }

  private updateView(): void {
    const isEnabled = this.featureService.isEnabled(this.featureName);

    if (isEnabled && !this.isShown) {
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.isShown = true;
    } else if (!isEnabled) {
      this.viewContainer.clear();
      if (this.elseTemplate) {
        this.viewContainer.createEmbeddedView(this.elseTemplate);
      }
      this.isShown = false;
    }
  }
}

/**
 * *featureFlagHide directive - hides element when feature is enabled
 * Inverse of *featureFlag - useful for showing content when AI is disabled
 * 
 * Usage:
 *   <div *featureFlagHide="'ai_chat'">AI Chat is disabled</div>
 */
@Directive({
  selector: '[featureFlagHide]',
  standalone: true
})
export class FeatureFlagHideDirective implements OnInit, OnDestroy {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private featureService = inject(FeatureFlagService);
  private destroyRef = inject(DestroyRef);

  private featureName = '';
  private isShown = false;

  @Input()
  set featureFlagHide(featureName: string) {
    this.featureName = featureName;
    this.updateView();
  }

  ngOnInit(): void {
    this.featureService.flagChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateView());
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
  }

  private updateView(): void {
    const isEnabled = this.featureService.isEnabled(this.featureName);

    if (!isEnabled && !this.isShown) {
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.isShown = true;
    } else if (isEnabled && this.isShown) {
      this.viewContainer.clear();
      this.isShown = false;
    }
  }
}

/**
 * *featureFlagAny directive - shows element when ANY of the features is enabled
 * 
 * Usage:
 *   <div *featureFlagAny="['ai_chat', 'ai_voice']">Some AI feature is enabled</div>
 */
@Directive({
  selector: '[featureFlagAny]',
  standalone: true
})
export class FeatureFlagAnyDirective implements OnInit, OnDestroy {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private featureService = inject(FeatureFlagService);
  private destroyRef = inject(DestroyRef);

  private featureNames: string[] = [];
  private isShown = false;

  @Input()
  set featureFlagAny(featureNames: string[]) {
    this.featureNames = featureNames;
    this.updateView();
  }

  ngOnInit(): void {
    this.featureService.flagChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateView());
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
  }

  private updateView(): void {
    const anyEnabled = this.featureNames.some(name => 
      this.featureService.isEnabled(name)
    );

    if (anyEnabled && !this.isShown) {
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.isShown = true;
    } else if (!anyEnabled && this.isShown) {
      this.viewContainer.clear();
      this.isShown = false;
    }
  }
}

/**
 * *featureFlagAll directive - shows element only when ALL features are enabled
 * 
 * Usage:
 *   <div *featureFlagAll="['premium', 'ai_chat']">Premium AI Chat</div>
 */
@Directive({
  selector: '[featureFlagAll]',
  standalone: true
})
export class FeatureFlagAllDirective implements OnInit, OnDestroy {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private featureService = inject(FeatureFlagService);
  private destroyRef = inject(DestroyRef);

  private featureNames: string[] = [];
  private isShown = false;

  @Input()
  set featureFlagAll(featureNames: string[]) {
    this.featureNames = featureNames;
    this.updateView();
  }

  ngOnInit(): void {
    this.featureService.flagChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateView());
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
  }

  private updateView(): void {
    const allEnabled = this.featureNames.every(name => 
      this.featureService.isEnabled(name)
    );

    if (allEnabled && !this.isShown) {
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.isShown = true;
    } else if (!allEnabled && this.isShown) {
      this.viewContainer.clear();
      this.isShown = false;
    }
  }
}

// Export all directives for easy importing
export const FEATURE_FLAG_DIRECTIVES = [
  FeatureFlagDirective,
  FeatureFlagHideDirective,
  FeatureFlagAnyDirective,
  FeatureFlagAllDirective
];
