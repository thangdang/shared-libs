import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'auth_interceptor.dart';

/// Vietnamese error messages for common API errors (MT2 — MREQ-2).
const Map<int, String> _viErrorMessages = {
  400: 'Dữ liệu không hợp lệ',
  401: 'Vui lòng đăng nhập lại',
  403: 'Không có quyền truy cập',
  404: 'Không tìm thấy nội dung',
  429: 'Quá nhiều yêu cầu — vui lòng đợi',
  500: 'Hệ thống gặp sự cố — thử lại sau',
  503: 'Dịch vụ đang bảo trì',
};

/// Shared API client for all WinLux products.
/// Provides: base URL config, JWT auth, token refresh, connectivity-aware retry,
/// Vietnamese error messages, and structured error handling.
///
/// Usage:
///   final api = ApiClient(baseUrl: 'https://smartbuy.winlux.com/api');
///   final response = await api.get('/products?q=iphone');
class ApiClient {
  late final Dio _dio;
  final String baseUrl;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final int maxRetries;

  ApiClient({required this.baseUrl, Duration? timeout, this.maxRetries = 2}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: timeout ?? const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(AuthInterceptor(_dio, _storage));
    _dio.interceptors.add(_RetryInterceptor(maxRetries: maxRetries));
    _dio.interceptors.add(LogInterceptor(requestBody: false, responseBody: false));
  }

  /// GET request with automatic auth header + retry.
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

  /// Get Vietnamese error message for an API error.
  static String getVietnameseError(DioException error) {
    final statusCode = error.response?.statusCode;
    final serverMessageVi = error.response?.data?['message_vi'];
    if (serverMessageVi != null && serverMessageVi.toString().isNotEmpty) {
      return serverMessageVi.toString();
    }
    if (statusCode != null && _viErrorMessages.containsKey(statusCode)) {
      return _viErrorMessages[statusCode]!;
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return 'Kết nối chậm — vui lòng thử lại';
    }
    if (error.type == DioExceptionType.connectionError) {
      return 'Không có kết nối mạng';
    }
    return 'Đã xảy ra lỗi — vui lòng thử lại sau';
  }

  /// Check current connectivity status.
  static Future<bool> hasConnectivity() async {
    final result = await Connectivity().checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }
}

/// Retry interceptor — retries failed requests with exponential backoff.
/// Only retries on network errors and 5xx, not 4xx (client errors).
class _RetryInterceptor extends Interceptor {
  final int maxRetries;

  _RetryInterceptor({this.maxRetries = 2});

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final shouldRetry = _isRetryable(err);
    final attempts = (err.requestOptions.extra['_retry_count'] ?? 0) as int;

    if (shouldRetry && attempts < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s
      final delay = Duration(milliseconds: 1000 * (1 << attempts));
      await Future.delayed(delay);

      // Check connectivity before retrying
      final hasNet = await ApiClient.hasConnectivity();
      if (!hasNet) {
        handler.reject(err);
        return;
      }

      // Retry the request
      err.requestOptions.extra['_retry_count'] = attempts + 1;
      try {
        final response = await Dio().fetch(err.requestOptions);
        handler.resolve(response);
        return;
      } catch (e) {
        // Let it fall through to reject
      }
    }

    handler.reject(err);
  }

  bool _isRetryable(DioException err) {
    // Retry on connection errors and server errors (5xx)
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.connectionError) {
      return true;
    }
    final statusCode = err.response?.statusCode ?? 0;
    return statusCode >= 500;
  }
}
