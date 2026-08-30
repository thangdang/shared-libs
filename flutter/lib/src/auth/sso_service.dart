/// SSO Service — Google, Apple, Zalo sign-in helpers.
/// Wraps platform-specific SDKs for consistent API across all apps.
class SSOService {
  /// Trigger Google Sign-In and return ID token.
  static Future<String?> signInWithGoogle() async {
    // Uses google_sign_in package (each app adds it to their pubspec)
    // Returns idToken to send to backend /auth/google
    try {
      final googleSignIn = await _getGoogleSignIn();
      final account = await googleSignIn.signIn();
      final auth = await account?.authentication;
      return auth?.idToken;
    } catch (_) {
      return null;
    }
  }

  /// Trigger Apple Sign-In and return identity token.
  static Future<String?> signInWithApple() async {
    // Uses sign_in_with_apple package
    // Returns identityToken to send to backend /auth/apple
    try {
      // Platform check: only available on iOS
      final credential = await _getAppleCredential();
      return credential?.identityToken;
    } catch (_) {
      return null;
    }
  }

  /// Trigger Zalo login and return auth code.
  static Future<String?> signInWithZalo() async {
    // Uses zalo_flutter package
    // Returns code to send to backend /auth/zalo
    try {
      final result = await _getZaloAuthCode();
      return result;
    } catch (_) {
      return null;
    }
  }

  // Private helpers — actual SDK calls (implemented per-platform)
  static Future<dynamic> _getGoogleSignIn() async {
    // Lazy import to avoid dependency issues if google_sign_in not added
    throw UnimplementedError('Add google_sign_in to your app pubspec');
  }

  static Future<dynamic> _getAppleCredential() async {
    throw UnimplementedError('Add sign_in_with_apple to your app pubspec');
  }

  static Future<String?> _getZaloAuthCode() async {
    throw UnimplementedError('Add zalo_flutter to your app pubspec');
  }
}
