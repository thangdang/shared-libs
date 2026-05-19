# Angular Performance Optimization Guide

> This guide documents patterns for optimizing Angular frontends across all WinLux apps.
> Each app's routing module must be modified individually — these are the patterns to follow.

---

## 1. Lazy Loading Routes

Convert eager-loaded routes to lazy-loaded standalone components to reduce initial bundle size.

### Before (eager loading)

```typescript
import { FeedComponent } from './feed/feed.component';
import { ProfileComponent } from './profile/profile.component';

const routes: Routes = [
  { path: 'feed', component: FeedComponent },
  { path: 'profile', component: ProfileComponent },
];
```

### After (lazy loading)

```typescript
const routes: Routes = [
  {
    path: 'feed',
    loadComponent: () => import('./feed/feed.component').then(m => m.FeedComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent)
  },
];
```

### Lazy loading feature modules

```typescript
const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },
];
```

### Priority: Apply to these apps

- `trendbriefai-ui` — lazy load Feed, Analytics, Settings modules
- `smartbuy-ui` — lazy load Products, Cart, Checkout, Account modules
- `caremate-ui` — lazy load Chat, History, Profile modules
- `fintax-ui` — lazy load Transactions, Reports, Import modules

---

## 2. Virtual Scrolling for Long Lists

Use Angular CDK virtual scroll for lists with 50+ items to avoid rendering all DOM nodes.

### Setup

```bash
npm install @angular/cdk
```

### Implementation

```typescript
// In your module or standalone component imports
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  standalone: true,
  imports: [ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport itemSize="120" class="viewport">
      <app-card *cdkVirtualFor="let item of items" [item]="item" />
    </cdk-virtual-scroll-viewport>
  `,
  styles: [`
    .viewport {
      height: 80vh;
      width: 100%;
    }
  `]
})
export class ProductListComponent {
  items: Product[] = [];
}
```

### Priority: Apply to these views

- SmartBuy product grid (100+ products per category)
- TrendBrief news feed (infinite scroll)
- FIN Tax transaction list (thousands of records)
- CareMate chat history

---

## 3. NgOptimizedImage for Image Loading

Use Angular's built-in `NgOptimizedImage` directive for automatic lazy loading, srcset generation, and LCP optimization.

### Setup

```typescript
import { NgOptimizedImage } from '@angular/common';

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  template: `
    <img ngSrc="{{item.image}}" width="400" height="225" loading="lazy" />
  `
})
```

### Above-the-fold images (LCP candidates)

```html
<!-- Mark hero/banner images as priority to preload them -->
<img ngSrc="{{hero.image}}" width="1200" height="600" priority />
```

### Responsive images

```html
<img
  ngSrc="{{item.image}}"
  width="400"
  height="225"
  sizes="(max-width: 768px) 100vw, 400px"
  loading="lazy"
/>
```

### Priority: Apply to these components

- SmartBuy product cards and thumbnails
- TrendBrief article hero images
- CareMate avatar images

---

## 4. Bundle Budget Configuration

Add size budgets to `angular.json` to catch bundle size regressions during build.

### Configuration (add to `angular.json` → projects → [app] → architect → build → configurations → production)

```json
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "1.5mb",
    "maximumError": "2mb"
  },
  {
    "type": "anyComponentStyle",
    "maximumWarning": "6kb",
    "maximumError": "10kb"
  }
]
```

### What the budgets mean

| Budget | Warning | Error | Purpose |
|--------|---------|-------|---------|
| `initial` | 1.5 MB | 2 MB | Total initial JS bundle (before lazy chunks) |
| `anyComponentStyle` | 6 KB | 10 KB | Per-component CSS size |

### If budget is exceeded

1. Check for accidentally imported large libraries in main bundle
2. Move heavy components to lazy-loaded routes
3. Use `source-map-explorer` to identify large chunks:
   ```bash
   npx source-map-explorer dist/browser/main.*.js
   ```

---

## 5. Additional Optimizations

### OnPush Change Detection

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

Apply to all presentational/dumb components to reduce change detection cycles.

### TrackBy for ngFor

```html
<div *ngFor="let item of items; trackBy: trackById">
  <app-card [item]="item" />
</div>
```

```typescript
trackById(index: number, item: any): string {
  return item._id;
}
```

### Preloading Strategy

```typescript
// In app routing module
@NgModule({
  imports: [RouterModule.forRoot(routes, {
    preloadingStrategy: PreloadAllModules
  })],
})
export class AppRoutingModule {}
```

This preloads lazy modules in the background after initial load completes.

---

## Implementation Checklist

- [ ] Convert all feature routes to lazy loading in each app
- [ ] Add virtual scroll to lists with 50+ items
- [ ] Replace `<img>` with `ngSrc` in all product/article cards
- [ ] Add bundle budgets to all `angular.json` files
- [ ] Set `OnPush` on all presentational components
- [ ] Add `trackBy` to all `*ngFor` loops
- [ ] Run `ng build --configuration production` and verify no budget errors
