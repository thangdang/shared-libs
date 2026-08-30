import 'dart:convert';
import 'package:sqflite/sqflite.dart';

/// Sync Queue — Queues actions when offline, syncs when back online.
/// Used for: bookmarks, transactions, feedback submissions.
class SyncQueue {
  Database? _db;
  final String dbName;

  SyncQueue({required this.dbName});

  Future<Database> get db async {
    _db ??= await openDatabase(
      '${dbName}_sync.db',
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            method TEXT NOT NULL,
            data TEXT,
            created_at INTEGER NOT NULL,
            retries INTEGER DEFAULT 0
          )
        ''');
      },
    );
    return _db!;
  }

  /// Add action to sync queue (called when offline).
  Future<void> enqueue({
    required String action,
    required String endpoint,
    required String method,
    Map<String, dynamic>? data,
  }) async {
    final database = await db;
    await database.insert('sync_queue', {
      'action': action,
      'endpoint': endpoint,
      'method': method,
      'data': data != null ? jsonEncode(data) : null,
      'created_at': DateTime.now().millisecondsSinceEpoch,
    });
  }

  /// Get all pending actions (FIFO order).
  Future<List<Map<String, dynamic>>> getPending() async {
    final database = await db;
    return database.query('sync_queue', orderBy: 'created_at ASC');
  }

  /// Remove a completed action from queue.
  Future<void> remove(int id) async {
    final database = await db;
    await database.delete('sync_queue', where: 'id = ?', whereArgs: [id]);
  }

  /// Increment retry count for failed sync.
  Future<void> incrementRetry(int id) async {
    final database = await db;
    await database.rawUpdate('UPDATE sync_queue SET retries = retries + 1 WHERE id = ?', [id]);
  }

  /// Remove actions that exceeded max retries.
  Future<int> removeStale({int maxRetries = 5}) async {
    final database = await db;
    return database.delete('sync_queue', where: 'retries >= ?', whereArgs: [maxRetries]);
  }

  /// Get queue size.
  Future<int> getSize() async {
    final database = await db;
    final result = await database.rawQuery('SELECT COUNT(*) as count FROM sync_queue');
    return Sqflite.firstIntValue(result) ?? 0;
  }
}
