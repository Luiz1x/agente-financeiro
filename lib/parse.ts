import { addDays, CATS, parseValor, today, uid } from './data';
import type { Rascunho, Tipo } from './data';

/**
 * Reads phrases like "gastei 32 no ifood e 18,50 de uber ontem" without AI:
 * splits clauses, finds the amount, guesses type, category and date by keywords.
 */

const SAIDA_KW: [RegExp, string][] = [
  [/ifood|rappi|delivery|pizza|\bz[eé] delivery/i, 'Delivery'],
  [/uber|[oô]nibus|gasolina|combust[ií]vel|metr[oô]|passagem|estacionamento|\btaxi\b|t[aá]xi/i, 'Transporte'],
  [/supermercado|mercado|feira|atacad/i, 'Mercado'],
  [/lanche|almo[cç]o|janta|restaurante|padaria|caf[eé]|comida|a[cç]a[ií]|hamb[uú]rguer|sorvete/i, 'Alimentação'],
  [/netflix|spotify|prime video|disney|youtube premium|assinatura|\bhbo\b|deezer/i, 'Assinaturas'],
  [/\bjogo|\bskin|steam|valorant|\blol\b|riot|\bpsn\b|xbox|\bgame/i, 'Jogos'],
  [/\bluz\b|[aá]gua|internet|celular|\bconta\b|aluguel|boleto|fatura/i, 'Contas'],
  [/farm[aá]cia|rem[eé]dio|m[eé]dico|consulta|academia|dentista/i, 'Saúde'],
  [/curso|livro|faculdade|escola|apostila/i, 'Educação'],
  [/cinema|\bbar\b|festa|show|rol[eê]|balada|cerveja/i, 'Lazer'],
  [/roupa|t[eê]nis|loja|shopping|camisa|bon[eé]|presente pr/i, 'Compras'],
];

const ENTRADA_RE = /receb|ganhei|entrou|caiu|sal[aá]rio|vendi|freela|me pagou|me pagaram|reembols|devolveram|pix d[aeo]/i;
const ENTRADA_KW: [RegExp, string][] = [
  [/sal[aá]rio|freela|pagamento|me pagou|me pagaram|trabalho/i, 'Renda'],
  [/vendi|venda/i, 'Venda'],
  [/reembols|devolveram|devolu/i, 'Reembolso'],
  [/presente|m[aã]e|\bpai\b|v[oó]\b|v[oó]v[oó]|tia|tio|padrinho|madrinha/i, 'Presente'],
];

const STOP = new Set(('gastei paguei comprei recebi ganhei entrou caiu foi foram no na nos nas de do da dos das com em um uma uns umas ' +
  'reais real r$ conto contos pila pilas ontem hoje anteontem o a os as pra pro para meu minha e que mais tb tambem também ' +
  'gasto gastos vendi me pagou pagaram pix dia').split(' '));

const AMOUNT = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(k\b|mil\b)?/i;

function dateOf(c: string): string {
  if (/anteontem/i.test(c)) return addDays(-2);
  if (/ontem/i.test(c)) return addDays(-1);
  const m = c.match(/\bdia\s+(\d{1,2})\b/i);
  if (m) {
    const d = Number(m[1]);
    const now = new Date();
    if (d >= 1 && d <= 31) {
      const dt = new Date(now.getFullYear(), now.getMonth(), d);
      if (dt > now) dt.setMonth(dt.getMonth() - 1);
      const z = (n: number) => String(n).padStart(2, '0');
      return `${dt.getFullYear()}-${z(dt.getMonth() + 1)}-${z(dt.getDate())}`;
    }
  }
  return today();
}

function titleCase(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

export function parseFrase(text: string): Rascunho[] {
  const clauses = text
    .replace(/\n+/g, ' ; ')
    .split(/\s+e\s+|,\s+|;|\s+mais\s+/i)
    .map(s => s.trim())
    .filter(Boolean);

  const out: Rascunho[] = [];
  let lastTipo: Tipo | null = null;

  for (const raw of clauses) {
    const c = raw.replace(/\bdia\s+\d{1,2}\b/gi, ' ');
    const m = c.match(AMOUNT);
    if (!m) continue;
    let valor = parseValor(m[1]);
    if (m[2]) valor = valor * 1000;
    if (!Number.isFinite(valor) || valor <= 0) continue;

    const isEntrada = ENTRADA_RE.test(raw);
    const tipo: Tipo = isEntrada ? 'entrada' : (lastTipo === 'entrada' && !/gast|pague|compre/i.test(raw) && out.length ? 'entrada' : 'saida');
    lastTipo = tipo;

    let categoria = 'Outros';
    for (const [re, cat] of tipo === 'entrada' ? ENTRADA_KW : SAIDA_KW) { if (re.test(raw)) { categoria = cat; break; } }
    if (!CATS[tipo].includes(categoria)) categoria = 'Outros';

    const words = c.replace(m[0], ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
      .filter(w => w && !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w));
    const descricao = titleCase(words.slice(0, 4).join(' ')) || categoria;

    out.push({ key: uid(), tipo, valor: Math.round(valor * 100) / 100, descricao, categoria, data: dateOf(raw) });
  }
  return out;
}
