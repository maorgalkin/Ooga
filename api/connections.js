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
function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex")
  };
  return JSON.stringify(blob);
}

// api-src/connections.ts
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const userId = await requireAuth(req);
    const supabase = getAdminClient();
    if (req.method === "GET") {
      const { data, error } = await supabase.from("bank_connections").select("id, provider, display_name, last_sync_at, is_active, created_at").eq("user_id", userId).eq("is_active", true).order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return res.json({ connections: data ?? [] });
    }
    if (req.method === "POST") {
      const { provider, credentials, displayName } = req.body;
      if (!provider || !credentials) {
        return res.status(400).json({ error: "provider and credentials are required" });
      }
      const credentials_encrypted = encrypt(JSON.stringify(credentials));
      const { data: conn, error: insErr } = await supabase.from("bank_connections").insert({
        user_id: userId,
        provider,
        display_name: displayName ?? provider,
        credentials_encrypted,
        is_active: true
      }).select("id, provider, display_name, last_sync_at, is_active, created_at").single();
      if (insErr) throw new Error(insErr.message);
      return res.status(201).json({ connection: conn });
    }
    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id query param required" });
      const { error } = await supabase.from("bank_connections").delete().eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return res.status(204).end();
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(401).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[connections]", message);
    return res.status(500).json({ error: message });
  }
}
export {
  handler as default
};
