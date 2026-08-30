# @winlux/service-clients

> Internal service HTTP clients with fault tolerance

## Features

| Feature | Description |
|---------|-------------|
| **AI Engine Client** | HTTP client for AI services |
| **Backoffice Client** | Admin API client |
| **Notification Client** | Notification service client |
| **Payment Client** | Payment service client |
| **Circuit Breaker** | Fault tolerance pattern |

## Installation

```bash
npm install @winlux/service-clients
```

## Usage

```typescript
import { 
  AIEngineClient, 
  BackofficeClient,
  NotificationClient,
  PaymentClient
} from '@winlux/service-clients';

// AI Engine calls
const ai = new AIEngineClient({ 
  baseUrl: process.env.AI_ENGINE_URL 
});
const analysis = await ai.analyzeSymptoms({ text: 'đau đầu' });
const summary = await ai.summarize({ text: article });

// Backoffice calls
const backoffice = new BackofficeClient({
  baseUrl: process.env.BACKOFFICE_URL,
  apiKey: process.env.BACKOFFICE_API_KEY
});
await backoffice.createAlert({ type: 'crawler_failed' });

// Notification calls
const notify = new NotificationClient({
  baseUrl: process.env.NOTIFICATION_URL
});
await notify.sendZNS({ phone, templateId, data });

// Payment calls
const payment = new PaymentClient({
  baseUrl: process.env.PAYMENT_URL
});
const order = await payment.createOrder({ amount, description });
```

## Circuit Breaker

All clients include circuit breaker:

```typescript
const ai = new AIEngineClient({
  baseUrl: process.env.AI_ENGINE_URL,
  circuitBreaker: {
    threshold: 5,
    timeout: 30000,
    resetTimeout: 60000
  }
});
```

## Configuration

```env
AI_ENGINE_URL=http://100.x.x.2:8001
BACKOFFICE_URL=http://localhost:3010
NOTIFICATION_URL=http://localhost:3020
PAYMENT_URL=http://localhost:3030
```

## Used By

All WinLux AI products
