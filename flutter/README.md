# winlux_flutter_core

> Flutter SDK for WinLux mobile applications

## Features

| Feature | Description |
|---------|-------------|
| **Theme** | WinLux design system (colors, typography) |
| **Widgets** | Reusable UI components |
| **State Management** | Riverpod providers |
| **API Client** | Dio-based HTTP client with interceptors |
| **Auth** | JWT + biometric authentication |
| **Storage** | Secure storage wrapper |

## Installation

```yaml
dependencies:
  winlux_flutter_core:
    path: ../shared-libs/flutter
```

## Usage

```dart
import 'package:winlux_flutter_core/winlux_flutter_core.dart';

// Theme
MaterialApp(
  theme: WinluxTheme.light,
  darkTheme: WinluxTheme.dark,
);

// Widgets
WinluxButton(
  label: 'Submit',
  onPressed: () => handleSubmit(),
  variant: ButtonVariant.primary,
);

WinluxTextField(
  label: 'Email',
  controller: emailController,
  validator: Validators.email,
);

// API Client
final api = WinluxApiClient(
  baseUrl: 'https://api.smartbuy.winlux.com',
  authProvider: authProvider,
);
final response = await api.get('/products');

// Auth
final auth = WinluxAuth();
await auth.loginWithZalo();
await auth.enableBiometric();

// Secure Storage
final storage = WinluxStorage();
await storage.setSecure('token', jwtToken);
final token = await storage.getSecure('token');
```

## Configuration

```dart
void main() {
  WinluxCore.init(
    apiBaseUrl: 'https://api.winlux.com',
    environment: Environment.production,
  );
  runApp(MyApp());
}
```

## Used By

Future mobile apps (SmartBuy Mobile, CareMate Mobile)
