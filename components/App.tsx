'use client';

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  CATS, EMOJI, fmt, fmtDay, monthLabel, parseValor, seed, shiftMonth, today, totals, uid, cents,
} from '@/lib/data';
import type { Lancamento, Rascunho, Tipo } from '@/lib/data';
import { parseFrase } from '@/lib/parse';
import { BalanceCard, CoinBurst, Money, Panel, Ring } from './ui';

const KEY = 'bolso.next.v1';
type View = 'home' | 'list' | 'insights';
const VIEWS: View[] = ['home', 'list', 'insights'];
const EASE = [0.16, 1, 0.3, 1] as const;

interface Store { items: Lancamento[]; budget: number | null }

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.items)) return { items: s.items, budget: typeof s.budget === 'number' ? s.budget : null };
    }
  } catch { /* storage unavailable */ }
  return { items: seed(), budget: 1500 };
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Lancamento[]>([]);
  const [budget, setBudget] = useState<number | null>(null);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [view, setView] = useState<View>('home');
  const [dir, setDir] = useState(1);
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<Rascunho[]>([]);
  const [status, setStatus] = useState<{ msg: string; err?: boolean }>({ msg: '' });
  const [toast, setToast] = useState('');
  const [burst, setBurst] = useState(0);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetIn, setBudgetIn] = useState('');
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => { const s = load(); setItems(s.items); setBudget(s.budget); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify({ items, budget })); } catch { /* ignore */ }
  }, [items, budget, ready]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2300); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(null), 3000); return () => clearTimeout(t); }, [armed]);

  const list = useMemo(() => items
    .filter(i => i.data.slice(0, 7) === month)
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm - a.criadoEm), [items, month]);
  const T = useMemo(() => totals(list), [list]);
  const prevT = useMemo(() => totals(items.filter(i => i.data.slice(0, 7) === shiftMonth(month, -1))), [items, month]);

  const go = (v: View) => {
    setDir(VIEWS.indexOf(v) >= VIEWS.indexOf(view) ? 1 : -1);
    setView(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---------- lançar ---------- */
  const lancar = () => {
    const t = text.trim();
    if (!t) { setStatus({ msg: 'Escreva o que gastou ou recebeu.', err: true }); return; }
    const got = parseFrase(t);
    if (!got.length) { setStatus({ msg: 'Não achei nenhum valor. Inclua quanto foi, tipo "lanche 25".', err: true }); return; }
    setDrafts(d => [...d, ...got]);
    setText('');
    setStatus({ msg: got.length > 1 ? `Encontrei ${got.length} lançamentos. Confira e salve.` : 'Confira e salve.' });
  };
  const manual = () => setDrafts(d => [...d, { key: uid(), tipo: 'saida', valor: NaN, descricao: '', categoria: 'Alimentação', data: today() }]);
  const patch = (key: string, p: Partial<Rascunho>) => setDrafts(ds => ds.map(d => (d.key === key ? { ...d, ...p } : d)));
  const salvar = () => {
    if (drafts.some(d => !(Number.isFinite(d.valor) && d.valor > 0) || !d.data)) {
      setStatus({ msg: 'Preencha o valor e a data de todos os lançamentos.', err: true }); return;
    }
    const now = Date.now();
    setItems(it => [...it, ...drafts.map((d, i) => ({
      id: uid(), tipo: d.tipo, valor: d.valor, descricao: d.descricao.trim() || d.categoria, categoria: d.categoria, data: d.data, criadoEm: now + i,
    }))]);
    setToast(drafts.length > 1 ? `${drafts.length} lançamentos salvos` : 'Lançamento salvo');
    setDrafts([]); setStatus({ msg: '' }); setBurst(b => b + 1);
    const last = drafts[drafts.length - 1];
    if (last) setMonth(last.data.slice(0, 7));
  };
  const apagar = (id: string) => {
    if (armed !== id) { setArmed(id); return; }
    setItems(it => it.filter(i => i.id !== id)); setArmed(null); setToast('Lançamento apagado');
  };
  const salvarLimite = () => {
    const v = parseValor(budgetIn);
    setBudget(Number.isFinite(v) && v > 0 ? v : null);
    setEditBudget(false); setToast('Limite salvo');
  };
  const restaurar = () => { const s = seed(); setItems(s); setBudget(1500); setToast('Exemplos restaurados'); };

  /* ---------- derived for budget / insights ---------- */
  const isCurrent = month === today().slice(0, 7);
  const now = new Date();
  const dim = (() => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate(); })();
  const daysGone = isCurrent ? now.getDate() : dim;
  const left = budget ? budget - T.out : 0;
  const perDay = budget && isCurrent ? left / (dim - now.getDate() + 1) : 0;
  const cats = Object.entries(T.byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] || 1;

  const daily = useMemo(() => {
    const arr = Array.from({ length: dim }, () => 0);
    for (const i of list) if (i.tipo === 'saida') { const d = Number(i.data.slice(8, 10)); if (d >= 1 && d <= dim) arr[d - 1] += cents(i.valor) / 100; }
    return arr;
  }, [list, dim]);
  const dailyMax = Math.max(1, ...daily);
  const projection = daysGone ? (T.out / daysGone) * dim : 0;
  const diffPrev = prevT.out ? (T.out - prevT.out) / prevT.out : null;

  const dica = (() => {
    if (!list.length) return 'Lance seus primeiros gastos para receber dicas.';
    const [topCat, topV] = cats[0] || ['', 0];
    if (budget && projection > budget) return `No ritmo atual você termina o mês em ${fmt(projection)}, acima do limite de ${fmt(budget)}. Segurar ${topCat} já ajuda: foram ${fmt(topV / 100)} até agora.`;
    if (topCat && T.out && topV / 100 / T.out > 0.3) return `${topCat} levou ${Math.round((topV / 100 / T.out) * 100)}% dos seus gastos. Se cortar 20% disso, sobram ${fmt((topV / 100) * 0.2)} a mais.`;
    if (T.saldo > 0) return `Sobraram ${fmt(T.saldo)} até agora. Separar 10% disso (${fmt(T.saldo * 0.1)}) num cofrinho já cria o hábito.`;
    return 'Seus gastos passaram do que entrou. Vale olhar o extrato e achar o que dá pra cortar.';
  })();

  return (
    <>
      <CoinBurst fire={burst} />
      <AnimatePresence>
        {toast && (
          <motion.div className="toast" role="status"
            initial={{ y: -80, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
            <span className="ok">✓</span>{toast}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="wrap">
        <motion.header className="top" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <div className="brand"><span className="dot" />bolso</div>
          <div className="month">
            <motion.button whileTap={{ scale: 0.85 }} aria-label="Mês anterior" onClick={() => setMonth(m => shiftMonth(m, -1))}>‹</motion.button>
            <AnimatePresence mode="wait" initial={false}>
              <motion.b key={month} className="num" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {monthLabel(month)}
              </motion.b>
            </AnimatePresence>
            <motion.button whileTap={{ scale: 0.85 }} aria-label="Próximo mês" onClick={() => setMonth(m => shiftMonth(m, 1))}>›</motion.button>
          </div>
        </motion.header>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={view}
            className="wrap"
            custom={dir}
            initial={{ opacity: 0, x: dir * 40, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: dir * -40, filter: 'blur(8px)' }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {view === 'home' && (
              <>
                <BalanceCard saldo={T.saldo} inn={T.inn} out={T.out} />

                <Panel className={`composer ${drafts.length ? 'has-drafts' : ''}`} transition={{ duration: 0.6, delay: 0.08, ease: EASE }}>
                  <div className="panel-head"><h2>O que entrou ou saiu?</h2><button className="link" onClick={manual}>Lançar à mão</button></div>
                  <textarea
                    id="quick" rows={2} value={text}
                    placeholder="Ex.: gastei 32 no ifood e 18,50 de uber ontem"
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); lancar(); } }}
                  />
                  <div className="chips">
                    {['gastei 32 no ifood', 'uber 18,50 ontem', 'recebi 500 de presente', 'mercado 146,90 e pizza 38'].map(c => (
                      <motion.button key={c} className="chip" whileTap={{ scale: 0.92 }} whileHover={{ y: -2 }} onClick={() => setText(c)}>{c}</motion.button>
                    ))}
                  </div>
                  <motion.button className="btn full" whileTap={{ scale: 0.97 }} onClick={lancar}>Lançar</motion.button>
                  <div className={`status ${status.err ? 'err' : ''}`}>{status.msg}</div>

                  <AnimatePresence initial={false}>
                    {drafts.map(d => (
                      <motion.div key={d.key} className="draft" layout
                        initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: -60, height: 0, padding: 0, marginTop: -10 }}
                        transition={{ duration: 0.35, ease: EASE }}>
                        <div className="draft-top">
                          <div className="seg">
                            {(['saida', 'entrada'] as Tipo[]).map(k => (
                              <button key={k} type="button" className={k === 'saida' ? 'o' : 'i'} aria-pressed={d.tipo === k}
                                onClick={() => patch(d.key, { tipo: k, categoria: CATS[k].includes(d.categoria) ? d.categoria : 'Outros' })}>
                                {k === 'saida' ? 'Saída' : 'Entrada'}
                              </button>
                            ))}
                          </div>
                          <button className="x" type="button" aria-label="Remover" onClick={() => setDrafts(ds => ds.filter(x => x.key !== d.key))}>×</button>
                        </div>
                        <div className="grid2">
                          <label className="field"><span>Valor (R$)</span>
                            <input inputMode="decimal" placeholder="0,00" defaultValue={Number.isFinite(d.valor) ? String(d.valor).replace('.', ',') : ''}
                              onChange={e => patch(d.key, { valor: parseValor(e.target.value) })} />
                          </label>
                          <label className="field"><span>Data</span>
                            <input type="date" value={d.data} onChange={e => patch(d.key, { data: e.target.value })} />
                          </label>
                        </div>
                        <div className="grid2">
                          <label className="field"><span>Descrição</span>
                            <input value={d.descricao} placeholder="Ex.: lanche" onChange={e => patch(d.key, { descricao: e.target.value })} />
                          </label>
                          <label className="field"><span>Categoria</span>
                            <select value={d.categoria} onChange={e => patch(d.key, { categoria: e.target.value })}>
                              {CATS[d.tipo].map(c => <option key={c} value={c}>{EMOJI[c]} {c}</option>)}
                            </select>
                          </label>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {drafts.length > 0 && (
                    <motion.div className="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <motion.button className="btn full" whileTap={{ scale: 0.97 }} onClick={salvar}>Salvar</motion.button>
                      <button className="btn ghost" onClick={() => { setDrafts([]); setStatus({ msg: '' }); }}>Cancelar</button>
                    </motion.div>
                  )}
                </Panel>

                <Panel transition={{ duration: 0.6, delay: 0.16, ease: EASE }}>
                  <div className="panel-head"><h2>Limite do mês</h2>
                    <button className="link" onClick={() => { setEditBudget(v => !v); setBudgetIn(budget ? String(budget).replace('.', ',') : ''); }}>{budget ? 'Alterar' : 'Definir'}</button>
                  </div>
                  {budget ? (
                    <div className="budget">
                      <Ring pct={T.out / budget} />
                      <div className="budget-info">
                        <div className="l1 num">{left >= 0 ? `Faltam ${fmt(left)}` : `Passou ${fmt(-left)}`}</div>
                        <div className="small muted num">{fmt(T.out)} de {fmt(budget)}</div>
                        {isCurrent && <div className="small muted">{left > 0 ? `Cerca de ${fmt(perDay)} por dia até o fim do mês.` : 'Você já passou do limite deste mês.'}</div>}
                      </div>
                    </div>
                  ) : <div className="small muted">Defina um teto mensal para ver quanto ainda pode gastar por dia.</div>}
                  <AnimatePresence>
                    {editBudget && (
                      <motion.div className="budget-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <label className="field" style={{ flex: 1 }}><span>Quanto quer gastar no máximo por mês</span>
                          <input inputMode="decimal" placeholder="Ex.: 1200" value={budgetIn} onChange={e => setBudgetIn(e.target.value)} />
                        </label>
                        <button className="btn" onClick={salvarLimite}>Salvar</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Panel>

                <Panel transition={{ duration: 0.6, delay: 0.24, ease: EASE }}>
                  <div className="panel-head"><h2>Para onde foi</h2></div>
                  <div className="cats">
                    {!cats.length && <Empty glyph="🧭" title="Nada gasto ainda" text="Os gastos do mês aparecem aqui, separados por categoria." />}
                    {cats.map(([c, v], i) => (
                      <div key={c} className="cat">
                        <span className="em">{EMOJI[c] || '•'}</span>
                        <span className="t">{c}</span>
                        <span className="v num">{fmt(v / 100)} · {Math.round((v / (T.out * 100)) * 100)}%</span>
                        <div className="track">
                          <motion.i initial={{ width: 0 }} animate={{ width: `${(v / maxCat) * 100}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.06, ease: EASE }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel transition={{ duration: 0.6, delay: 0.32, ease: EASE }}>
                  <div className="panel-head"><h2>Últimos lançamentos</h2><button className="link" onClick={() => go('list')}>Ver extrato</button></div>
                  <div className="items">
                    {!list.length && <Empty glyph="✍️" title="Nenhum lançamento neste mês" text='Escreva algo como "gastei 25 no lanche" no campo acima.' />}
                    <AnimatePresence initial={false}>
                      {list.slice(0, 5).map((it, i) => <Row key={it.id} it={it} i={i} />)}
                    </AnimatePresence>
                  </div>
                </Panel>

                <div className="tip"><span aria-hidden="true">📲</span><span><b>Use como app no Android:</b> abra no Chrome, toque nos três pontinhos (⋮) e escolha <b>Adicionar à tela inicial</b>.</span></div>
              </>
            )}

            {view === 'list' && (
              <Panel>
                <div className="panel-head"><h2>Extrato do mês</h2><span className="muted small num">{list.length ? `${list.length} ${list.length === 1 ? 'lançamento' : 'lançamentos'}` : ''}</span></div>
                {!list.length && <Empty glyph="📭" title="Extrato vazio" text="Quando você lançar algo neste mês, aparece aqui por dia." />}
                {groupByDay(list).map(([day, rows]) => (
                  <div key={day}>
                    <div className="day">{fmtDay(day)}</div>
                    <div className="items">
                      <AnimatePresence initial={false}>
                        {rows.map((it, i) => (
                          <Row key={it.id} it={it} i={i}>
                            <motion.button className={`del ${armed === it.id ? 'armed' : ''}`} whileTap={{ scale: 0.9 }} onClick={() => apagar(it.id)}>
                              {armed === it.id ? 'Confirmar' : 'Apagar'}
                            </motion.button>
                          </Row>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </Panel>
            )}

            {view === 'insights' && (
              <>
                <Panel>
                  <div className="panel-head"><h2>Resumo de {monthLabel(month).split(' ')[0]}</h2></div>
                  <div className="stats">
                    <div className="stat"><small>Média por dia</small><Money value={daysGone ? T.out / daysGone : 0} className="num" /></div>
                    <div className="stat"><small>{isCurrent ? 'Projeção do mês' : 'Total gasto'}</small><Money value={isCurrent ? projection : T.out} className="num" /></div>
                    <div className="stat"><small>Vs. mês passado</small>
                      <b className={`num ${diffPrev === null ? '' : diffPrev > 0 ? 'neg' : 'pos'}`}>
                        {diffPrev === null ? '—' : `${diffPrev > 0 ? '+' : ''}${Math.round(diffPrev * 100)}%`}
                      </b>
                    </div>
                    <div className="stat"><small>Maior categoria</small><b>{cats[0] ? `${EMOJI[cats[0][0]] || ''} ${cats[0][0]}` : '—'}</b></div>
                  </div>
                </Panel>

                <Panel transition={{ duration: 0.6, delay: 0.08, ease: EASE }}>
                  <div className="panel-head"><h2>Gastos por dia</h2><span className="muted small num">pico {fmt(dailyMax === 1 && !daily.some(Boolean) ? 0 : dailyMax)}</span></div>
                  <div className="chart" role="img" aria-label="Gráfico de gastos por dia do mês">
                    {daily.map((v, i) => (
                      <div key={i} className="col" title={`Dia ${i + 1}: ${fmt(v)}`}>
                        <motion.i
                          className={isCurrent && i + 1 === now.getDate() ? 'today' : ''}
                          initial={{ height: 0 }} animate={{ height: `${Math.max(v ? 4 : 0, (v / dailyMax) * 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.15 + i * 0.015, ease: EASE }} />
                      </div>
                    ))}
                  </div>
                  <div className="chart-axis small muted num"><span>1</span><span>{Math.ceil(dim / 2)}</span><span>{dim}</span></div>
                </Panel>

                <Panel className="advice" transition={{ duration: 0.6, delay: 0.16, ease: EASE }}>
                  <div className="panel-head"><h2>Dica do mês</h2></div>
                  <p>{dica}</p>
                </Panel>

                <div className="tip"><span aria-hidden="true">✨</span><span>Na versão que roda dentro do Claude, a IA lê suas frases e um <b>assistente</b> responde perguntas sobre seus gastos. Esta é a demonstração, com dados salvos só neste navegador. <button className="link inline" onClick={restaurar}>Restaurar exemplos</button></span></div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      <nav className="tabs" aria-label="Seções">
        <LayoutGroup>
          <div className="tabs-in">
            {VIEWS.map(v => (
              <button key={v} onClick={() => go(v)} aria-current={view === v ? 'page' : undefined}>
                {view === v && <motion.span layoutId="tabpill" className="pill" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                <span className="tab-ico">{ICONS[v]}</span>
                <span className="tab-lbl">{v === 'home' ? 'Início' : v === 'list' ? 'Extrato' : 'Insights'}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </nav>
    </>
  );
}

function groupByDay(list: Lancamento[]): [string, Lancamento[]][] {
  const out: [string, Lancamento[]][] = [];
  for (const it of list) {
    const last = out[out.length - 1];
    if (last && last[0] === it.data) last[1].push(it); else out.push([it.data, [it]]);
  }
  return out;
}

function Row({ it, i, children }: { it: Lancamento; i: number; children?: React.ReactNode }) {
  const t = it.tipo === 'entrada' ? 'i' : 'o';
  return (
    <motion.div className="item" layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 80, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.35, delay: Math.min(i, 10) * 0.03, ease: EASE }}>
      <div className={`ico ${t}`}>{EMOJI[it.categoria] || '•'}</div>
      <div className="d"><b>{it.descricao || it.categoria}</b><small>{it.categoria} · {fmtDay(it.data)}</small></div>
      <div className={`val num ${t}`}>{t === 'i' ? '+' : '−'}{fmt(it.valor)}</div>
      {children ?? <span />}
    </motion.div>
  );
}

function Empty({ glyph, title, text }: { glyph: string; title: string; text: string }) {
  return (
    <div className="empty">
      <motion.div className="glyph" animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>{glyph}</motion.div>
      <b>{title}</b><span className="small">{text}</span>
    </div>
  );
}

const ICONS: Record<View, React.ReactNode> = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>,
  insights: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>,
};
