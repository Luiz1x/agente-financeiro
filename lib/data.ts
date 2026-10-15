export type Tipo = 'saida' | 'entrada';

export interface Lancamento {
  id: string;
  tipo: Tipo;
  valor: number;
  descricao: string;
  categoria: string;
  data: string; // AAAA-MM-DD
  criadoEm: number;
}

export interface Rascunho {
  key: string;
  tipo: Tipo;
  valor: number;
  descricao: string;
  categoria: string;
  data: string;
}

export const CATS: Record<Tipo, string[]> = {
  saida: ['Alimentação', 'Delivery', 'Mercado', 'Transporte', 'Lazer', 'Jogos', 'Compras', 'Contas', 'Assinaturas', 'Saúde', 'Educação', 'Outros'],
  entrada: ['Renda', 'Presente', 'Reembolso', 'Venda', 'Outros'],
};

export const EMOJI: Record<string, string> = {
  'Alimentação': '🍔', Delivery: '🛵', Mercado: '🛒', Transporte: '🚗', Lazer: '🎉', Jogos: '🎮',
  Compras: '🛍️', Contas: '🧾', Assinaturas: '📺', 'Saúde': '💊', 'Educação': '📚', Outros: '•',
  Renda: '💼', Presente: '🎁', Reembolso: '↩️', Venda: '🏷️',
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmt = (v: number) => BRL.format(v);

const z = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
export const today = () => ymd(new Date());
export const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

export function parseValor(s: unknown): number {
  let t = String(s ?? '').trim().replace(/[R$\s]/gi, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const cents = (v: number) => Math.round(Number(v || 0) * 100);

export function totals(list: Lancamento[]) {
  let i = 0, o = 0;
  const byCat: Record<string, number> = {};
  for (const it of list) {
    const c = cents(it.valor);
    if (it.tipo === 'entrada') i += c;
    else { o += c; const k = it.categoria || 'Outros'; byCat[k] = (byCat[k] || 0) + c; }
  }
  return { inn: i / 100, out: o / 100, saldo: (i - o) / 100, byCat };
}

export function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
}

export function shiftMonth(m: string, d: number) {
  const [y, mo] = m.split('-').map(Number);
  const nd = new Date(y, mo - 1 + d, 1);
  return `${nd.getFullYear()}-${z(nd.getMonth() + 1)}`;
}

export function fmtDay(s: string) {
  if (!s) return '';
  if (s === today()) return 'hoje';
  if (s === addDays(-1)) return 'ontem';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Example data for the demo, spread over the current month. */
export function seed(): Lancamento[] {
  const now = new Date();
  const day = now.getDate();
  const at = (back: number) => ymd(new Date(now.getFullYear(), now.getMonth(), Math.max(1, day - back)));
  const rows: [Tipo, number, string, string, number][] = [
    ['entrada', 1800, 'Salário', 'Renda', day - 1],
    ['saida', 32, 'iFood', 'Delivery', 0],
    ['saida', 18.5, 'Uber', 'Transporte', 0],
    ['saida', 146.9, 'Mercado do mês', 'Mercado', 1],
    ['saida', 55.9, 'Spotify e Netflix', 'Assinaturas', 2],
    ['saida', 89.9, 'Skin no jogo', 'Jogos', 3],
    ['saida', 120, 'Conta de celular', 'Contas', 4],
    ['saida', 42, 'Lanche com amigos', 'Lazer', 5],
    ['entrada', 150, 'Presente da vó', 'Presente', 6],
    ['saida', 27.4, 'Gasolina', 'Transporte', 6],
    ['saida', 64.5, 'Farmácia', 'Saúde', 8],
    ['saida', 38, 'Pizza', 'Delivery', 9],
  ];
  // last month, so the comparison in Insights has something to compare with
  const prev = (d: number) => ymd(new Date(now.getFullYear(), now.getMonth() - 1, d));
  const old: [Tipo, number, string, string, string][] = [
    ['entrada', 1800, 'Salário', 'Renda', prev(5)],
    ['saida', 210, 'Mercado', 'Mercado', prev(6)],
    ['saida', 96, 'iFood', 'Delivery', prev(9)],
    ['saida', 120, 'Conta de celular', 'Contas', prev(10)],
    ['saida', 55.9, 'Assinaturas', 'Assinaturas', prev(12)],
    ['saida', 180, 'Tênis', 'Compras', prev(18)],
    ['saida', 74, 'Uber', 'Transporte', prev(22)],
  ];
  return [
    ...rows.map(([tipo, valor, descricao, categoria, b], i) => ({ id: 'ex' + i, tipo, valor, descricao, categoria, data: at(b), criadoEm: i })),
    ...old.map(([tipo, valor, descricao, categoria, data], i) => ({ id: 'old' + i, tipo, valor, descricao, categoria, data, criadoEm: i })),
  ];
}
