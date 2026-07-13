import 'package:sqflite/sqflite.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Shared Offline Cache Service — SQLite-based caching for all apps.
/// Stores API responses locally, serves them when offline.
class CacheService {
  Database? _db;
  final String dbName;

  CacheService({required this.dbName});

  Future<Database> get db async {
    _db ??= await openDatabase(
      '$dbName.db',
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE cache (
            key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL
          )
        ''');
      },
    );
    return _db!;
  }

  /// Get cached data (returns null if expired or not found).
  Future<String?> get(String key) async {
    final database = await db;
    final now = DateTime.now().millisecondsSinceEpoch;

    final results = await database.query(
      'cache',
      where: 'key = ? AND expires_at > ?',
      whereArgs: [key, now],
    );

    if (results.isEmpty) return null;
    return results.first['data'] as String;
  }

  /// Store data in cache with TTL.
  Future<void> set(String key, String data, {Duration ttl = const Duration(hours: 24)}) async {
    final database = await db;
    final now = DateTime.now().millisecondsSinceEpoch;
    final expiresAt = now + ttl.inMilliseconds;

    await database.insert(
      'cache',
      {'key': key, 'data': data, 'expires_at': expiresAt, 'created_at': now},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Remove specific cached item.
  Future<void> remove(String key) async {
    final database = await db;
    await database.delete('cache', where: 'key = ?', whereArgs: [key]);
  }

  /// Clear all expired cache entries.
  Future<int> clearExpired() async {
    final database = await db;
    final now = DateTime.now().millisecondsSinceEpoch;
    return await database.delete('cache', where: 'expires_at < ?', whereArgs: [now]);
  }

  /// Clear all cache.
  Future<void> clearAll() async {
    final database = await db;
    await database.delete('cache');
  }

  /// Get cache size (number of entries).
  Future<int> getSize() async {
    final database = await db;
    final result = await database.rawQuery('SELECT COUNT(*) as count FROM cache');
    return Sqflite.firstIntValue(result) ?? 0;
  }
}
