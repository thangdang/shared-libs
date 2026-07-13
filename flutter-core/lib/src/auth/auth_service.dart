import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';

/// Shared Auth Service — login, register, token management.
/// All 5 apps use the same auth-service backend.
class AuthService {
  final ApiClient _api;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  AuthService(this._api);

  /// Login with email + password.
  Future<bool> login(String email, String password) async {
    try {
      final response = await _api.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      await _saveTokens(response.data);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Register new account.
  Future<bool> register(String email, String password, String name) async {
    try {
      final response = await _api.post('/auth/register', data: {
        'email': email,
        'password': password,
        'name': name,
      });
      await _saveTokens(response.data);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Login with Google token.
  Future<bool> loginWithGoogle(String idToken) async {
    try {
      final response = await _api.post('/auth/google', data: {'id_token': idToken});
      await _saveTokens(response.data);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Login with Zalo code.
  Future<bool> loginWithZalo(String code) async {
    try {
      final response = await _api.post('/auth/zalo', data: {'code': code});
      await _saveTokens(response.data);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Login with Apple token.
  Future<bool> loginWithApple(String identityToken) async {
    try {
      final response = await _api.post('/auth/apple', data: {'identity_token': identityToken});
      await _saveTokens(response.data);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Logout — clear tokens.
  Future<void> logout() async {
    await _api.clearAuth();
  }

  /// Check if user is logged in.
  Future<bool> isLoggedIn() async {
    return await _api.isAuthenticated();
  }

  /// Get current user ID from stored token.
  Future<String?> getUserId() async {
    return await _storage.read(key: 'user_id');
  }

  Future<void> _saveTokens(Map<String, dynamic> data) async {
    await _storage.write(key: 'access_token', value: data['access_token']);
    await _storage.write(key: 'refresh_token', value: data['refresh_token']);
    if (data['user_id'] != null) {
      await _storage.write(key: 'user_id', value: data['user_id']);
    }
  }
}
