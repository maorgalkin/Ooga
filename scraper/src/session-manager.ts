import crypto from 'crypto';

export interface ScrapeSession {
  id: string;
  status: 'logging_in' | 'awaiting_otp' | 'importing' | 'complete' | 'error';
  otpResolver?: (code: string) => void;
  result?: {
    imported: number;
    skipped: number;
  };
  error?: string;
  createdAt: Date;
  /** Supabase bank_import_sessions.id — set once the DB record is created */
  dbSessionId?: string;
}

const sessions = new Map<string, ScrapeSession>();

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function createSession(): ScrapeSession {
  const id = crypto.randomUUID();
  const session: ScrapeSession = {
    id,
    status: 'logging_in',
    createdAt: new Date(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): ScrapeSession | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, updates: Partial<ScrapeSession>): void {
  const session = sessions.get(id);
  if (session) {
    Object.assign(session, updates);
  }
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}

// Periodically clean up expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt.getTime() > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 60_000);
