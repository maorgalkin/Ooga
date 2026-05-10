// lib/supabase-admin.ts
function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required");
  return { url, key };
}
var QueryBuilder = class {
  _table;
  _url;
  _key;
  _method = "GET";
  _select = "*";
  _eqFilters = [];
  _inFilters = [];
  _order = null;
  _limit = null;
  _single = false;
  _body = null;
  _returnRepr = false;
  constructor(table, url, key) {
    this._table = table;
    this._url = url;
    this._key = key;
  }
  select(cols) {
    this._select = cols;
    return this;
  }
  eq(col, val) {
    this._eqFilters.push([col, String(val)]);
    return this;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  in(col, vals) {
    this._inFilters.push([col, vals.map(String)]);
    return this;
  }
  limit(n) {
    this._limit = n;
    return this;
  }
  order(col, opts) {
    this._order = `${col}.${opts?.ascending === false ? "desc" : "asc"}`;
    return this;
  }
  single() {
    this._single = true;
    if (!this._limit) this._limit = 1;
    return this;
  }
  insert(body) {
    this._method = "POST";
    this._body = body;
    this._returnRepr = true;
    return this;
  }
  update(body) {
    this._method = "PATCH";
    this._body = body;
    return this;
  }
  delete() {
    this._method = "DELETE";
    return this;
  }
  async execute() {
    const params = new URLSearchParams();
    if (this._method === "GET") params.set("select", this._select);
    else if (this._returnRepr && this._select !== "*") params.set("select", this._select);
    for (const [col, val] of this._eqFilters) params.set(col, `eq.${val}`);
    for (const [col, vals] of this._inFilters) params.set(col, `in.(${vals.join(",")})`);
    if (this._order) params.set("order", this._order);
    if (this._limit && this._method === "GET") params.set("limit", String(this._limit));
    const prefer = [];
    if (this._returnRepr) prefer.push("return=representation");
    const headers = {
      "Content-Type": "application/json",
      "apikey": this._key,
      "Authorization": `Bearer ${this._key}`
    };
    if (prefer.length) headers["Prefer"] = prefer.join(",");
    if (this._single && this._method === "GET") {
    }
    const qs = params.toString();
    const endpoint = `${this._url}/rest/v1/${this._table}${qs ? "?" + qs : ""}`;
    const res = await fetch(endpoint, {
      method: this._method,
      headers,
      body: this._body != null ? JSON.stringify(this._body) : void 0
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: { message: String(body.message ?? body.error ?? `HTTP ${res.status}`) } };
    }
    if (res.status === 204) return { data: null, error: null };
    const data = await res.json();
    if (this._single && Array.isArray(data)) return { data: data[0] ?? null, error: null };
    return { data, error: null };
  }
  // Makes this thenable so callers can `await builder.select(...).eq(...)`
  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
};
function getAdminClient() {
  const { url, key } = getConfig();
  return {
    from: (table) => new QueryBuilder(table, url, key),
    auth: {
      getUser: async (token) => {
        const res = await fetch(`${url}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: key }
        });
        if (!res.ok) return { data: { user: null }, error: { message: "Invalid token" } };
        const user = await res.json();
        return { data: { user }, error: null };
      }
    }
  };
}
async function requireAuth(req) {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw new AuthError("Missing Authorization header");
  const { url, key } = getConfig();
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: key }
  });
  if (!res.ok) throw new AuthError("Invalid or expired auth token");
  const user = await res.json();
  if (!user?.id) throw new AuthError("Invalid or expired auth token");
  return user.id;
}
var AuthError = class extends Error {
  status = 401;
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
};

// lib/crypto-utils.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
var ALGORITHM = "aes-256-gcm";
function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}
function decrypt(ciphertext) {
  const key = getKey();
  const blob = JSON.parse(ciphertext);
  const iv = Buffer.from(blob.iv, "hex");
  const tag = Buffer.from(blob.tag, "hex");
  const data = Buffer.from(blob.data, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

// lib/bank-helpers.ts
async function loadCredentials(connectionId, userId) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("bank_connections").select("credentials_encrypted").eq("id", connectionId).eq("user_id", userId).single();
  if (error) throw new Error(`Connection not found (db: ${error.message})`);
  if (!data) throw new Error("Connection not found (no row returned)");
  return JSON.parse(decrypt(data.credentials_encrypted));
}

// api-src/cal-import.ts
import { createHash } from "crypto";
var OTP_URL = "https://connect.cal-online.co.il/col-rest/calconnect/authentication/otp";
var AUTH_SITE_ID = "5B5160DD-F84A-4D72-B67E-65891BA194FF";
var TXN_SITE_ID = "09031987-273E-2311-906C-8AF85B17C8D9";
var FRAMES_URL = "https://api.cal-online.co.il/Frames/api/Frames/GetFrameStatus";
var PENDING_URL = "https://api.cal-online.co.il/Transactions/api/approvals/getClearanceRequests";
var TXN_URL = "https://api.cal-online.co.il/Transactions/api/transactionsDetails/getCardTransactionsDetails";
var CARDS_ENDPOINT_CANDIDATES = [
  // Most likely: init/cards endpoints on api domain
  { method: "GET", url: "https://api.cal-online.co.il/api/init" },
  { method: "GET", url: "https://api.cal-online.co.il/api/Init" },
  { method: "GET", url: "https://api.cal-online.co.il/Cards/api/Cards/GetCards" },
  { method: "GET", url: "https://api.cal-online.co.il/Cards/api/Cards/GetUserCards" },
  { method: "GET", url: "https://api.cal-online.co.il/UserCards/api/UserCards/GetUserCards" },
  { method: "GET", url: "https://api.cal-online.co.il/api/v1/init" },
  { method: "POST", url: "https://api.cal-online.co.il/api/init" },
  // Connect domain variants
  { method: "GET", url: "https://connect.cal-online.co.il/col-rest/calconnect/cards" },
  { method: "GET", url: "https://connect.cal-online.co.il/col-rest/calconnect/userCards" }
];
function calAuthHeaders(calToken, siteId) {
  return {
    "Content-Type": "application/json",
    "Authorization": `CALAuthScheme ${calToken}`,
    "X-Site-Id": siteId,
    "origin": "https://digital-web.cal-online.co.il",
    "referer": "https://digital-web.cal-online.co.il/",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  };
}
async function verifyOtp(custID, otpCode, calSessionToken) {
  const res = await fetch(OTP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-site-id": AUTH_SITE_ID,
      "origin": "https://connect.cal-online.co.il",
      "referer": "https://connect.cal-online.co.il/verify-otp",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    },
    body: JSON.stringify({ custID, password: otpCode, token: calSessionToken })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = extractString(body, ["message", "error", "description"]) ?? `HTTP ${res.status}`;
    throw new Error(`OTP verification failed: ${msg}`);
  }
  const calToken = extractString(body, ["calConnectToken"]) ?? extractString(body, ["auth", "calConnectToken"]) ?? // { auth: { calConnectToken } }
  extractString(body, ["result", "calConnectToken"]) ?? extractString(body, ["data", "calConnectToken"]) ?? extractString(body, ["token"]);
  if (!calToken) {
    throw new Error(
      `Could not find calConnectToken in Cal response. Full response: ${JSON.stringify(body)}`
    );
  }
  return { calToken, fullResponse: body };
}
function extractString(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return null;
    cur = cur[key];
  }
  return typeof cur === "string" && cur.length > 0 ? cur : null;
}
async function getCards(calToken, otpResponse) {
  const cardsFromAuth = extractCardsFromObject(otpResponse);
  if (cardsFromAuth) {
    console.log("[cal-import] Cards found in OTP verify response");
    return cardsFromAuth;
  }
  const authHeaders = calAuthHeaders(calToken, TXN_SITE_ID);
  const diagnostics = {};
  for (const { method, url } of CARDS_ENDPOINT_CANDIDATES) {
    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: method === "POST" ? JSON.stringify({}) : void 0
      });
      const body = await res.json().catch(() => null);
      diagnostics[`${method} ${url}`] = { status: res.status, keys: body && typeof body === "object" ? Object.keys(body) : body };
      if (!res.ok || !body) continue;
      const cards = extractCardsFromObject(body);
      if (cards && cards.length > 0) {
        console.log(`[cal-import] Cards found at: ${method} ${url}`);
        return cards;
      }
    } catch (e) {
      diagnostics[`${method} ${url}`] = { error: e.message };
    }
  }
  try {
    const res = await fetch(FRAMES_URL, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ cardsForFrameData: [] })
    });
    const body = await res.json().catch(() => null);
    diagnostics["POST FRAMES/empty"] = { status: res.status, keys: body ? Object.keys(body) : null };
    if (res.ok && body) {
      const cards = extractCardsFromObject(body);
      if (cards && cards.length > 0) {
        console.log("[cal-import] Cards found via Frames endpoint with empty array");
        return cards;
      }
    }
  } catch (e) {
    diagnostics["POST FRAMES/empty"] = { error: e.message };
  }
  const hash = typeof otpResponse.hash === "string" ? otpResponse.hash : null;
  if (hash) {
    console.log("[cal-import] Trying OTP response hash as cardUniqueId:", hash);
    try {
      const res = await fetch(FRAMES_URL, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ cardsForFrameData: [{ cardUniqueId: hash }] })
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        diagnostics["POST FRAMES/hash"] = { status: res.status, keys: body ? Object.keys(body) : null };
        if (body) {
          console.log("[cal-import] Using hash as cardUniqueId \u2014 Frames responded OK");
          return [{ cardUniqueId: hash, last4Digits: "unknown" }];
        }
      }
    } catch {
    }
  }
  throw new Error(
    `Could not discover card IDs.
OTP response keys: ${Object.keys(otpResponse).join(", ")}
Diagnostics: ${JSON.stringify(diagnostics, null, 2)}`
  );
}
function extractCardsFromObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const key of ["cards", "result", "data"]) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0 && val[0]?.cardUniqueId) {
      return val.map(({ cardUniqueId, last4Digits }) => ({ cardUniqueId, last4Digits }));
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = extractCardsFromObject(val);
      if (nested) return nested;
    }
  }
  return null;
}
async function fetchPendingTransactions(calToken, cardUniqueId) {
  const res = await fetch(PENDING_URL, {
    method: "POST",
    headers: calAuthHeaders(calToken, TXN_SITE_ID),
    body: JSON.stringify({ cardUniqueIDArray: [cardUniqueId] })
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({}));
  const list = body?.result;
  if (!list?.cardsList) return [];
  return list.cardsList.flatMap((c) => c.authDetalisList ?? []);
}
async function fetchCompletedTransactions(calToken, cardUniqueId, month, year) {
  const res = await fetch(TXN_URL, {
    method: "POST",
    headers: calAuthHeaders(calToken, TXN_SITE_ID),
    body: JSON.stringify({ cardUniqueId, month, year })
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({}));
  const result = body?.result;
  const txns = [];
  if (result?.cardTransactionList) {
    for (const month2 of result.cardTransactionList) {
      if (month2?.txnIsrael) txns.push(...month2.txnIsrael);
      if (month2?.txnAbroad) txns.push(...month2.txnAbroad);
    }
  }
  return txns;
}
function normalizeTransaction(tx, cardUniqueId, isPending) {
  const chargedAmount = tx.chargedAmount ?? tx.transactionAmount ?? 0;
  const date = tx.debCrdDate ?? tx.transDate ?? tx.purchaseDate ?? (/* @__PURE__ */ new Date()).toISOString();
  const description = tx.merchantName ?? "Unknown";
  const dedupeHash = createHash("sha256").update(`${date.slice(0, 10)}|${chargedAmount}|${description}`).digest("hex");
  return {
    date: date.slice(0, 10),
    description,
    amount: Math.abs(chargedAmount),
    type: chargedAmount < 0 ? "income" : "expense",
    category: "Uncategorized",
    original_amount: tx.transactionAmount != null && tx.transactionAmount !== chargedAmount ? tx.transactionAmount : null,
    original_currency: tx.trnCurrencySymbol ?? null,
    processed_date: isPending ? null : tx.debCrdDate?.slice(0, 10) ?? null,
    installment_number: tx.currentPaymentNum ?? null,
    installment_total: tx.installmentsNumber ?? null,
    memo: tx.transTypeCommentDetails ? String(tx.transTypeCommentDetails) : null,
    bank_card_last4: null,
    dedupe_hash: dedupeHash,
    status: isPending ? "pending" : "completed",
    _cardUniqueId: cardUniqueId
  };
}
async function pushToSupabase(txns, userId, householdId, connectionId, dbSessionId) {
  const supabase = getAdminClient();
  const hashes = txns.map((t) => t.dedupe_hash);
  const { data: existing } = await supabase.from("transactions").select("dedupe_hash").eq("household_id", householdId).in("dedupe_hash", hashes);
  const existingSet = new Set((existing ?? []).map((r) => r.dedupe_hash));
  const newTxns = txns.filter((t) => !existingSet.has(t.dedupe_hash));
  if (newTxns.length === 0) {
    return { imported: 0, skipped: txns.length };
  }
  const rows = newTxns.map(({ _cardUniqueId: _, dedupe_hash, ...tx }) => ({
    ...tx,
    dedupe_hash,
    user_id: userId,
    household_id: householdId,
    bank_connection_id: connectionId,
    import_session_id: dbSessionId
  }));
  const { error } = await supabase.from("transactions").insert(rows);
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return { imported: newTxns.length, skipped: txns.length - newTxns.length };
}
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const userId = await requireAuth(req);
    const {
      connectionId,
      calSessionToken,
      otpCode,
      months = 3
    } = req.body;
    if (!connectionId || !calSessionToken || !otpCode) {
      return res.status(400).json({ error: "connectionId, calSessionToken, and otpCode are required" });
    }
    const creds = await loadCredentials(connectionId, userId);
    const custID = creds.id ?? creds.userId;
    if (!custID) return res.status(400).json({ error: "Stored credentials missing national ID (id field)" });
    const supabase = getAdminClient();
    const { data: hh } = await supabase.from("household_members").select("household_id").eq("user_id", userId).limit(1).single();
    if (!hh) return res.status(400).json({ error: "No household found for user" });
    const householdId = hh.household_id;
    console.log("[cal-import] Verifying OTP\u2026");
    const { calToken, fullResponse } = await verifyOtp(custID, otpCode, calSessionToken);
    console.log("[cal-import] OTP verified, token obtained");
    console.log("[cal-import] Discovering cards\u2026");
    const cards = await getCards(calToken, fullResponse);
    console.log(`[cal-import] Found ${cards.length} card(s):`, cards.map((c) => c.last4Digits));
    const now = /* @__PURE__ */ new Date();
    const monthYears = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthYears.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }
    const allTxns = [];
    await Promise.all(
      cards.map(async (card) => {
        const pending = await fetchPendingTransactions(calToken, card.cardUniqueId);
        allTxns.push(...pending.map((tx) => normalizeTransaction(tx, card.cardUniqueId, true)));
        for (const { month, year } of monthYears) {
          const completed = await fetchCompletedTransactions(calToken, card.cardUniqueId, month, year);
          allTxns.push(...completed.map((tx) => normalizeTransaction(tx, card.cardUniqueId, false)));
        }
      })
    );
    console.log(`[cal-import] Fetched ${allTxns.length} raw transactions`);
    const { data: sessionRow } = await supabase.from("bank_import_sessions").insert({
      user_id: userId,
      household_id: householdId,
      status: "complete",
      completed_at: (/* @__PURE__ */ new Date()).toISOString()
    }).select("id").single();
    const dbSessionId = sessionRow?.id ?? crypto.randomUUID();
    const { imported, skipped } = await pushToSupabase(
      allTxns,
      userId,
      householdId,
      connectionId,
      dbSessionId
    );
    await supabase.from("bank_connections").update({ last_sync_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", connectionId);
    console.log(`[cal-import] Done: ${imported} imported, ${skipped} skipped`);
    return res.json({ dbSessionId, imported, skipped });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message });
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[cal-import]", message);
    return res.status(500).json({ error: message });
  }
}
export {
  handler as default
};
