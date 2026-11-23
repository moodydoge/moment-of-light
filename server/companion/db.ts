import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

let db: DatabaseSync | null = null

export function getDb(dbPath?: string): DatabaseSync {
  if (db && !dbPath) return db
  const file =
    dbPath ||
    process.env.MOL_COMPANION_DB ||
    path.join(process.cwd(), 'data', 'companion.sqlite')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const next = new DatabaseSync(file)
  next.exec('PRAGMA journal_mode = WAL;')
  next.exec('PRAGMA foreign_keys = ON;')
  migrate(next)
  db = next
  return next
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companion_requests (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      topic_tag TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'pool',
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      matched_participant_id TEXT,
      human_session_id TEXT
    );

    CREATE TABLE IF NOT EXISTS companion_applications (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      responder_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(request_id, responder_id)
    );

    CREATE TABLE IF NOT EXISTS companion_sessions (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      requester_id TEXT NOT NULL,
      responder_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      end_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      client_message_id TEXT NOT NULL,
      UNIQUE(session_id, client_message_id)
    );

    CREATE TABLE IF NOT EXISTS safety_actions (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      target_user_id TEXT,
      session_id TEXT,
      type TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocks (
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (blocker_id, blocked_id)
    );

    CREATE TABLE IF NOT EXISTS session_feedback (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      role TEXT NOT NULL,
      feedback TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_requests_status ON companion_requests(status, expires_at);
    CREATE INDEX IF NOT EXISTS idx_apps_request ON companion_applications(request_id, status);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);
  `)
}

export function resetDbForTests(filePath: string) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  // Force the module singleton to the temp DB used by unit tests.
  db = null
  const next = getDb(filePath)
  db = next
  return next
}
