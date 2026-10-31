import crypto from 'crypto';

export interface SkippedCardBill {
  date: string;
  description: string;
  amount: number;
}

/** A fetched transaction that was already in the account (shown in the import review) */
export interface DuplicateSummary {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  reason?: 'exists' | 'deleted'; // already in the account / a member deleted it earlier
}

export interface ScrapeSession {
  id: string;
  userId: string; // Owner — status/OTP requests from other users are rejected
  status: 'logging_in' | 'awaiting_otp' | 'importing' | 'complete' | 'error';
  otpResolver?: (code: string) => void;
  result?: {
    /** Rows now waiting in the holding area for the person's Import (kept as `imported` for older apps) */
    imported: number;
    skipped: number;
    skippedCardBills?: SkippedCardBill[];
    duplicates?: DuplicateSummary[];
    /** 'staged': the rows wait in the import's holding area; apps check this to open that review */
    mode?: 'staged';
  };
  error?: string;
  createdAt: Date;
  /** Supabase bank_import_sessions.id — set once the DB record is created */
  dbSessionId?: string;
}

const sessions = new Map<string, ScrapeSession>();

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// One import per account at a time: two logins to the same bank at once can fail or lock it
const importsRunning = new Set<string>();

/** Claims `key` (a connection, or a whole household) for an import; false if one is running. */
export function tryLockImport(key: string): boolean {
  if (importsRunning.has(key)) return false;
  importsRunning.add(key);
  return true;
}

export function unlockImport(key: string): void {
  importsRunning.delete(key);
}

export function createSession(userId: string): ScrapeSession {
  const id = crypto.randomUUID();
  const session: ScrapeSession = {
    id,
    userId,
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
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt.getTime() > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 60_000);
sweep.unref?.(); // never the reason the process stays up
