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

// api-src/cal-otp-request.ts
var OTP_URL = "https://connect.cal-online.co.il/col-rest/calconnect/authentication/otp";
var AUTH_SITE_ID = "5B5160DD-F84A-4D72-B67E-65891BA194FF";
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const userId = await requireAuth(req);
    const { connectionId } = req.body;
    if (!connectionId) return res.status(400).json({ error: "connectionId is required" });
    const creds = await loadCredentials(connectionId, userId);
    const calUserId = creds.id ?? creds.userId;
    const { last4Digits } = creds;
    if (!calUserId || !last4Digits) {
      return res.status(400).json({ error: "Stored credentials missing userId or last4Digits" });
    }
    const calRes = await fetch(OTP_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-site-id": AUTH_SITE_ID,
        "origin": "https://connect.cal-online.co.il",
        "referer": "https://connect.cal-online.co.il/send-otp",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        userId: calUserId,
        last4Digits,
        bankAccountNum: last4Digits,
        sMSTemplate: null,
        recaptcha: ""
      })
    });
    const body = await calRes.json().catch(() => ({}));
    if (!calRes.ok) {
      console.error("[cal-otp-request] Cal API error:", calRes.status, body);
      return res.status(502).json({
        error: "Cal API rejected OTP request",
        detail: body
      });
    }
    const calSessionToken = body.token ?? body.result?.token ?? body.data?.token ?? body.sessionToken ?? body.result?.sessionToken;
    if (!calSessionToken) {
      console.error("[cal-otp-request] Unexpected response shape:", JSON.stringify(body));
      return res.status(502).json({
        error: "Could not find session token in Cal response",
        debug_response: body
        // expose to help discover field name
      });
    }
    return res.json({ calSessionToken });
  } catch (err) {
    if (err instanceof AuthError) return res.status(401).json({ error: err.message });
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[cal-otp-request]", message);
    return res.status(500).json({ error: message });
  }
}
export {
  handler as default
};
