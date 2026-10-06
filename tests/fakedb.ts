// Faux client Supabase en mémoire (sous-ensemble utilisé par src/lib/data.ts) pour tester la couche de données.
type Row = Record<string, any>;
export type Store = { companies: Row[]; clients: Row[]; quotes: Row[]; quote_lines: Row[]; counters: Record<string, number>; seq: number };
export const newStore = (): Store => ({ companies: [], clients: [], quotes: [], quote_lines: [], counters: {}, seq: 0 });

class Q {
  f: ((r: Row) => boolean)[] = []; op = 'select'; payload: any; ord: [string, boolean] | null = null; one = ''; cols = '*'; ret = false;
  s: Store; t: keyof Store;
  constructor(s: Store, t: keyof Store) { this.s = s; this.t = t; }
  select(cols = '*') { this.cols = cols; if (this.op !== 'select') this.ret = true; return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k: string, v: any) { this.f.push((r) => r[k] === v); return this; }
  in(k: string, vs: any[]) { this.f.push((r) => vs.includes(r[k])); return this; }
  order(k: string, o?: { ascending?: boolean }) { this.ord = [k, o?.ascending !== false]; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  then(res: any, rej: any) { return Promise.resolve(this.run()).then(res, rej); }
  rows(): Row[] { return this.s[this.t] as Row[]; }
  out(data: Row[]) {
    if (!this.one) return { data, error: null };
    if (data.length > 1) return { data: null, error: { message: 'plusieurs lignes' } };
    if (!data.length) return this.one === 'single' ? { data: null, error: { message: 'aucune ligne' } } : { data: null, error: null };
    return { data: data[0], error: null };
  }
  run(): any {
    const all = this.rows(), hit = (r: Row) => this.f.every((p) => p(r));
    if (this.op === 'insert') {
      const added = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p) => ({ id: `${this.t}-${++this.s.seq}`, created_at: this.s.seq, ...JSON.parse(JSON.stringify(p)) }));
      all.push(...added);
      return this.ret ? this.out(added) : { data: null, error: null };
    }
    if (this.op === 'update') {
      const m = all.filter(hit); m.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(this.payload))));
      return this.ret ? this.out(m) : { data: null, error: null };
    }
    if (this.op === 'delete') {
      const gone = all.filter(hit);
      (this.s[this.t] as Row[]) = all.filter((r) => !gone.includes(r));
      if (this.t === 'quotes') this.s.quote_lines = this.s.quote_lines.filter((l) => !gone.some((q) => q.id === l.quote_id)); // cascade
      if (this.t === 'clients') this.s.quotes.forEach((q) => { if (gone.some((c) => c.id === q.client_id)) q.client_id = null; }); // set null
      return { data: null, error: null };
    }
    let data = all.filter(hit).map((r) => ({ ...r }));
    if (this.ord) { const [k, asc] = this.ord; data.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1)); }
    if (this.t === 'quotes' && this.cols.includes('quote_lines')) data = data.map((q) => ({ ...q, quote_lines: this.s.quote_lines.filter((l) => l.quote_id === q.id).map((l) => ({ ...l })) }));
    return this.out(JSON.parse(JSON.stringify(data)));
  }
}

// Une « session » = un client connecté sur le même stockage. Une nouvelle session = reconnexion.
export function connect(s: Store, user = { id: 'u1', email: 'artisan@example.fr' }) {
  return {
    from: (t: keyof Store) => new Q(s, t),
    rpc: async (name: string, a: { p_company: string }) => {
      if (name !== 'next_quote_number') return { data: null, error: { message: 'rpc inconnue' } };
      const y = new Date().getFullYear(), k = `${a.p_company}:${y}`;
      s.counters[k] = (s.counters[k] ?? 0) + 1;
      return { data: `DEV-${y}-${String(s.counters[k]).padStart(3, '0')}`, error: null };
    },
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  };
}
