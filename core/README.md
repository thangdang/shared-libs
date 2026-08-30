# @winlux/core — Unified TypeScript Library

Unified shared library for all WinLux products.  Consolidates: `@winlux/auth`, `@winlux/payment`, `@winlux/notification`, `@winlux/analytics`, `@winlux/zalo-sdk`.

## Installation

In your app's `package.json`:

```json
{
  "dependencies": {
    "@winlux/core": "file:../../shared-libs/core"
  }
}
```

Then:

```bash
npm install
```

## Usage

### Single Import (All Features)

```typescript
import {
  // Auth
  TokenService, verifyGoogleToken, requireAuth, createAuthRoutes,
  // Payment
  SepayProvider, MoMoProvider, createPaymentRoutes,
  // Notification
  NotificationClient, FCMProvider,
  // Analytics
  Analytics, RevenueTracker,
  // Zalo
  ZaloSSO, ZaloOA,
} from '@winlux/core';
```

### Module Imports (Tree-Shaking)

```typescript
// Auth
import { TokenService, requireAuth, createAuthRoutes } from '@winlux/core/auth';

// Payment
import { SepayProvider, createPaymentRoutes } from '@winlux/core/payment';

// Notification
import { NotificationClient, FCMProvider } from '@winlux/core/notification';

// Analytics
import { Analytics, RevenueTracker } from '@winlux/core/analytics';

// Zalo
import { ZaloSSO, ZaloOA } from '@winlux/core/zalo';
```

## Modules

### Auth (`@winlux/core/auth`)

Authentication services and middleware:
- `TokenService`, `generateToken`, `verifyToken`, `refreshToken` — JWT handling
- `GoogleService`, `verifyGoogleToken` — Google SSO
- `ZaloService`, `authenticateWithZalo` — Zalo SSO
- `OTPService`, `sendOTP`, `verifyOTP` — OTP handling
- `requireAuth`, `optionalAuth` — Express middleware
- `createAuthRoutes`, `createUserRoutes`, `createTokenRoutes` — Route factories

### Payment (`@winlux/core/payment`)

Payment providers and webhook handling:
- `SepayProvider`, `MoMoProvider`, `ZaloPayProvider`, `PayOSProvider`, `StripeProvider`
- `createPaymentRoutes`, `createWebhookRoutes`, `createAdminRoutes` — Route factories
- `RefundService`, `ReconciliationService` — Business logic
- `WebhookTracker` — Webhook deduplication

### Notification (`@winlux/core/notification`)

Multi-channel notifications:
- `NotificationClient` — Unified client
- `FCMProvider`, `ZaloOAProvider`, `SMSProvider`, `EmailProvider`, `TelegramProvider`
- `NotificationScheduler` — Scheduled notifications
- `NotificationDigest` — Digest/batch notifications
- `DedupService`, `RateLimiter` — Protection

### Analytics (`@winlux/core/analytics`)

Event tracking and revenue:
- `Analytics` — Event tracking
- `RevenueTracker` — Revenue tracking
- `HealthChecker` — Service health monitoring
- `TrendScanner` — Trend detection

### Zalo (`@winlux/core/zalo`)

Zalo integration:
- `ZaloSSO` — SSO login
- `ZaloOA` — OA messaging
- `ZaloShareCard` — Share card builder
- `ZaloWebhook` — Webhook handler

## Migration from Separate Packages

| Old Import | New Import |
|------------|------------|
| `from '@winlux/auth'` | `from '@winlux/core/auth'` or `from '@winlux/core'` |
| `from '@winlux/payment'` | `from '@winlux/core/payment'` or `from '@winlux/core'` |
| `from '@winlux/notification'` | `from '@winlux/core/notification'` or `from '@winlux/core'` |
| `from '@winlux/analytics'` | `from '@winlux/core/analytics'` or `from '@winlux/core'` |
| `from '@winlux/zalo-sdk'` | `from '@winlux/core/zalo'` or `from '@winlux/core'` |

## Build

```bash
npm install
npm run build
```

## License

MIT
