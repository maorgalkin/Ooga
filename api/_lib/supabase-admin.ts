/**
 * Supabase admin client for server-side Vercel API functions.
 *
 * Uses Supabase REST API (fetch) directly — avoids importing @supabase/supabase-js,
 * which is a CJS package that can't be statically imported from Node.js ESM context
 * (Node.js 22 + "type":"module" in package.json).
 */

function getConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required');
  return { url, key };
}

// ─── Minimal PostgREST query builder ─────────────────────────────────────────

type Row = Record<string, unknown>;
type DbResult = { data: unknown; error: { message: string } | null };

class QueryBuilder {
  private _table: string;
  private _url: string;
  private _key: string;
  private _method = 'GET';
  private _select = '*';
  private _eqFilters: [string, string][] = [];
  private _inFilters: [string, string[]][] = [];
  private _order: string | null = null;
  private _limit: number | null = null;
  private _single = false;
  private _body: unknown = null;
  private _returnRepr = false;

  constructor(table: string, url: string, key: string) {
    this._table = table;
    this._url = url;
    this._key = key;
  }

  select(cols: string): this { this._select = cols; return this; }
  eq(col: string, val: unknown): this { this._eqFilters.push([col, String(val)]); return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  in(col: string, vals: any[]): this { this._inFilters.push([col, vals.map(String)]); return this; }
  limit(n: number): this { this._limit = n; return this; }
  order(col: string, opts?: { ascending?: boolean }): this {
    this._order = `${col}.${opts?.ascending === false ? 'desc' : 'asc'}`;
    return this;
  }
  single(): this { this._single = true; return this; }

  insert(body: Row | Row[]): this {
    this._method = 'POST';
    this._body = body;
    this._returnRepr = true;
    return this;
  }
  update(body: Row): this { this._method = 'PATCH'; this._body = body; return this; }
  delete(): this { this._method = 'DELETE'; return this; }

  async execute(): Promise<DbResult> {
    const params = new URLSearchParams();

    if (this._method === 'GET') params.set('select', this._select);
    else if (this._returnRepr && this._select !== '*') params.set('select', this._select);

    for (const [col, val] of this._eqFilters) params.set(col, `eq.${val}`);
    for (const [col, vals] of this._inFilters) params.set(col, `in.(${vals.join(',')})`);
    if (this._order) params.set('order', this._order);
    if (this._limit && this._method === 'GET') params.set('limit', String(this._limit));

    const prefer: string[] = [];
    if (this._returnRepr) prefer.push('return=representation');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this._key,
      'Authorization': `Bearer ${this._key}`,
    };
    if (prefer.length) headers['Prefer'] = prefer.join(',');
    if (this._single && this._method === 'GET') {
      headers['Accept'] = 'application/vnd.pgsql.single-object+json';
    }

    const qs = params.toString();
    const endpoint = `${this._url}/rest/v1/${this._table}${qs ? '?' + qs : ''}`;

    const res = await fetch(endpoint, {
      method: this._method,
      headers,
      body: this._body != null ? JSON.stringify(this._body) : undefined,
    });

    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await res.json().catch(() => ({})) as any;
      return { data: null, error: { message: String(body.message ?? body.error ?? `HTTP ${res.status}`) } };
    }
    if (res.status === 204) return { data: null, error: null };

    const data = await res.json();
    // POST with return=representation returns array; unwrap for .single()
    if (this._single && Array.isArray(data)) return { data: data[0] ?? null, error: null };
    return { data, error: null };
  }

  // Makes this thenable so callers can `await builder.select(...).eq(...)`
  then<T>(
    resolve: (v: DbResult) => T | PromiseLike<T>,
    reject?: (e: unknown) => T | PromiseLike<T>
  ): Promise<T> {
    return this.execute().then(resolve, reject);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAdminClient(): any {
  const { url, key } = getConfig();
  return {
    from: (table: string) => new QueryBuilder(table, url, key),
    auth: {
      getUser: async (token: string) => {
        const res = await fetch(`${url}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: key },
        });
        if (!res.ok) return { data: { user: null }, error: { message: 'Invalid token' } };
        const user = await res.json();
        return { data: { user }, error: null };
      },
    },
  };
}

export async function requireAuth(req: { headers: { authorization?: string } }): Promise<string> {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new AuthError('Missing Authorization header');

  const { url, key } = getConfig();
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: key },
  });
  if (!res.ok) throw new AuthError('Invalid or expired auth token');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await res.json() as any;
  if (!user?.id) throw new AuthError('Invalid or expired auth token');
  return user.id;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

