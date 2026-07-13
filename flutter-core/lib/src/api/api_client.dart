import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'auth_interceptor.dart';

/// Shared API client for all WinLux products.
/// Provides: base URL config, JWT auth, token refresh, retry, error handling.
///
/// Usage:
///   final api = ApiClient(baseUrl: 'https://smartbuy.winlux.com/api');
///   final response = await api.get('/products?q=iphone');
class ApiClient {
  late final Dio _dio;
  final String baseUrl;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiClient({required this.baseUrl, Duration? timeout}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: timeout ?? const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(AuthInterceptor(_dio, _storage));
    _dio.interceptors.add(LogInterceptor(requestBody: false, responseBody: false));
  }

  /// GET request with automatic auth header.
  Future<Response> get(String path, {Map<String, dynamic>? queryParams}) {
    return _dio.get(path, queryParameters: queryParams);
  }

  /// POST request.
  Future<Response> post(String path, {dynamic data}) {
    return _dio.post(path, data: data);
  }

  /// PUT request.
  Future<Response> put(String path, {dynamic data}) {
    return _dio.put(path, data: data);
  }

  /// DELETE request.
  Future<Response> delete(String path) {
    return _dio.delete(path);
  }

  /// PATCH request.
  Future<Response> patch(String path, {dynamic data}) {
    return _dio.patch(path, data: data);
  }

  /// Upload file (multipart).
  Future<Response> upload(String path, String filePath, {String fieldName = 'file'}) {
    final formData = FormData.fromMap({
      fieldName: MultipartFile.fromFileSync(filePath),
    });
    return _dio.post(path, data: formData);
  }

  /// Check if user is authenticated (has valid token).
  Future<bool> isAuthenticated() async {
    final token = await _storage.read(key: 'access_token');
    return token != null && token.isNotEmpty;
  }

  /// Clear auth tokens (logout).
  Future<void> clearAuth() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }
}
