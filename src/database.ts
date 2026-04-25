import { open, Database } from 'sqlite'
import sqlite3 from 'sqlite3'

let _db: Database | null = null

export async function getDb(): Promise<Database> {
  if (!_db) {
    _db = await open({ filename: ':memory:', driver: sqlite3.Database })
    await _db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id         TEXT PRIMARY KEY,
        client_id  TEXT NOT NULL,
        ticket_ids TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_status_history (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id   TEXT NOT NULL,
        status     TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS checkout_locks (
        order_id TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id         TEXT PRIMARY KEY,
        order_id   TEXT NOT NULL,
        payment_id TEXT NOT NULL,
        status     TEXT
      );
    `)
  }
  return _db
}
