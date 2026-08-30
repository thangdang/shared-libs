import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:winlux_core/src/api/api_client.dart';

void main() {
  group('ApiClient.getVietnameseError', () {
    test('returns server message_vi when available', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/test'),
        response: Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 400,
          data: {'error': 'bad request', 'message_vi': 'Dữ liệu sai rồi'},
        ),
      );
      expect(ApiClient.getVietnameseError(error), 'Dữ liệu sai rồi');
    });

    test('returns mapped message for status code', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/test'),
        response: Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 401,
          data: {'error': 'unauthorized'},
        ),
      );
      expect(ApiClient.getVietnameseError(error), 'Vui lòng đăng nhập lại');
    });

    test('returns timeout message for connection timeout', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/test'),
        type: DioExceptionType.connectionTimeout,
      );
      expect(ApiClient.getVietnameseError(error), 'Kết nối chậm — vui lòng thử lại');
    });

    test('returns network error message for connection error', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/test'),
        type: DioExceptionType.connectionError,
      );
      expect(ApiClient.getVietnameseError(error), 'Không có kết nối mạng');
    });

    test('returns generic message for unknown errors', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/test'),
        type: DioExceptionType.unknown,
      );
      final msg = ApiClient.getVietnameseError(error);
      expect(msg.contains('thử lại'), true);
    });

    test('handles 404 status', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/test'),
        response: Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 404,
          data: null,
        ),
      );
      expect(ApiClient.getVietnameseError(error), 'Không tìm thấy nội dung');
    });

    test('handles 429 rate limit', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/test'),
        response: Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 429,
          data: {},
        ),
      );
      expect(ApiClient.getVietnameseError(error), contains('yêu cầu'));
    });

    test('handles 503 service unavailable', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/test'),
        response: Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 503,
          data: {},
        ),
      );
      expect(ApiClient.getVietnameseError(error), contains('bảo trì'));
    });
  });
}
