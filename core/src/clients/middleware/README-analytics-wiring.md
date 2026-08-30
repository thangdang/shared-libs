# Analytics Middleware Wiring Guide (T55 — REQ-43)

> How to wire standardized analytics events into each product service.
> One-time setup: ~10 minutes per service.

## Step 1: Import middleware in service index.ts

```typescript
// In each product service's src/index.ts (after Express app creation):

import { analyticsMiddleware } from '@winlux/service-clients/middleware/analytics-events';

// Add after CORS, auth, rate-limit middleware:
app.use(analyticsMiddleware('smartbuy'));  // Change to product name
```

## Step 2: Use req.trackEvent() in route handlers

```typescript
// In any route handler:
router.post('/api/search', async (req, res) => {
  const results = await searchProducts(req.body.query);

  // Track search event (fire-and-forget, non-blocking)
  req.trackEvent('search', { query: req.body.query, results_count: results.length });

  res.json(results);
});

// Track affiliate clicks:
router.get('/api/affiliate/click/:id', async (req, res) => {
  req.trackEvent('click_affiliate', {
    product_id: req.params.id,
    platform: req.query.platform,
  });
  res.redirect(affiliateUrl);
});
```

## Step 3: Track revenue events in payment webhooks

```typescript
import { trackStandardEvent, EVENTS } from '@winlux/service-clients/middleware/analytics-events';

// In payment webhook handler:
if (payment.status === 'completed') {
  await trackStandardEvent('smartbuy', EVENTS.PAYMENT_SUCCESS, payment.userId, {
    amount: payment.amount,
    method: payment.method,
    plan: payment.plan,
  });
}
```

## Products to wire:

| # | Service | Product Name | File to modify |
|---|---------|-------------|----------------|
| 1 | smartbuy-service | `'smartbuy'` | `src/index.ts` |
| 2 | trendbriefai-service | `'trendbriefai'` | `src/index.ts` |
| 3 | caremate-service | `'caremate'` | `src/index.ts` |
| 4 | fin-tax-service | `'fintax'` | `src/index.ts` |
| 5 | doctor-car-service | `'doctorcar'` | `src/index.ts` |
| 6 | childhood-service | `'childhood'` | `src/index.ts` |

## Events emitted automatically by middleware:

- `page_view` — every non-health/non-internal request

## Events to emit manually per product:

| Event | When | Products |
|-------|------|----------|
| `click_affiliate` | User clicks affiliate link | SmartBuy, CareMate, DoctorCar |
| `subscribe` | User upgrades to Pro | All |
| `unsubscribe` | User cancels subscription | All |
| `ai_query` | User makes AI request | All |
| `payment_success` | Payment webhook confirms | SmartBuy, FIN Tax, DoctorCar |
| `payment_failed` | Payment fails | All |
| `share` | User shares content | All |
| `search` | User searches | SmartBuy, TrendBrief |
| `signup` | User creates account | All |
