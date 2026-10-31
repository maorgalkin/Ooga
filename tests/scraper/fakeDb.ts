// A small stand-in for the Supabase client the scraper code takes as `db`: records each query
// (table, operation, filters, payload) and answers from `respond`.
export interface Query {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  payload?: unknown;
  options?: unknown;
  filters: [string, ...unknown[]][];
}

export function fakeDb(respond: (q: Query) => { data?: unknown; error?: { message: string } | null }) {
  const queries: Query[] = [];
  const from = (table: string) => {
    const q: Query = { table, op: 'select', filters: [] };
    queries.push(q);
    const chain: Record<string, unknown> = {};
    const filter = (name: string) => (...args: unknown[]) => { q.filters.push([name, ...args]); return chain; };
    for (const f of ['eq', 'neq', 'in', 'is', 'not', 'order']) chain[f] = filter(f);
    chain.select = () => chain;
    chain.insert = (payload: unknown) => { q.op = 'insert'; q.payload = payload; return chain; };
    chain.update = (payload: unknown) => { q.op = 'update'; q.payload = payload; return chain; };
    chain.upsert = (payload: unknown, options: unknown) => { q.op = 'upsert'; q.payload = payload; q.options = options; return chain; };
    chain.delete = () => { q.op = 'delete'; return chain; };
    const result = () => ({ data: null, error: null, ...respond(q) });
    chain.maybeSingle = async () => result();
    chain.single = async () => result();
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
    return chain;
  };
  return { db: { from }, queries };
}

export const filterValue = (q: Query, name: string, column: string) => q.filters.find(f => f[0] === name && f[1] === column)?.[2];
