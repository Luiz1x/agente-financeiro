'use client';

import { animate, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmt } from '@/lib/data';

/** Number that counts up/down to its new value. */
export function Money({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === value) { el.textContent = fmt(value); return; }
    const c = animate(from, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => { el.textContent = fmt(v); },
    });
    return () => c.stop();
  }, [value]);
  return <span ref={ref} className={className}>{fmt(0)}</span>;
}

/** Glass panel with a light that follows the pointer (spotlight border). */
export function Panel({ children, className = '', ...rest }: { children: ReactNode; className?: string; [k: string]: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - r.left}px`);
    el.style.setProperty('--sy', `${e.clientY - r.top}px`);
  };
  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      className={`panel ${className}`}
      initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Realistic card that tilts with spring physics and moves its reflection. */
export function BalanceCard({ saldo, inn, out }: { saldo: number; inn: number; out: number }) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.3);
  const rx = useSpring(useTransform(py, [0, 1], [11, -11]), { stiffness: 180, damping: 16 });
  const ry = useSpring(useTransform(px, [0, 1], [-15, 15]), { stiffness: 180, damping: 16 });
  const gx = useTransform(px, v => `${v * 100}%`);
  const gy = useTransform(py, v => `${v * 100}%`);
  const holo = useTransform(px, v => `${v * 360}deg`);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => { px.set(0.5); py.set(0.3); };

  return (
    <div className="card-stage">
      <motion.div
        className="card"
        onPointerMove={onMove}
        onPointerLeave={reset}
        onPointerUp={reset}
        onPointerCancel={reset}
        style={{ rotateX: rx, rotateY: ry, ['--mx' as any]: gx, ['--my' as any]: gy, ['--holo' as any]: holo }}
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="card-lines" />
        <div className="card-holo" />
        <div className="card-row1">
          <div>
            <div className="card-lbl">Sobrou no mês</div>
            <Money value={saldo} className="card-big num" />
          </div>
          <div className="card-brand">bolso</div>
        </div>
        <div className="card-mid">
          <div className="card-chip" />
          <svg className="card-nfc" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M8 6a8 8 0 0 1 0 12M12 3.5a12 12 0 0 1 0 17M4.5 9a4 4 0 0 1 0 6" />
          </svg>
        </div>
        <div className="card-flow">
          <div><small>Entrou</small><Money value={inn} className="up" /></div>
          <div><small>Saiu</small><Money value={out} className="dn" /></div>
        </div>
      </motion.div>
    </div>
  );
}

/** Burst of coins from a point, used when something is saved. */
export function CoinBurst({ fire }: { fire: number }) {
  const [bursts, setBursts] = useState<number[]>([]);
  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setBursts(b => [...b, fire]);
    const t = setTimeout(() => setBursts(b => b.filter(x => x !== fire)), 1400);
    return () => clearTimeout(t);
  }, [fire]);
  return (
    <div className="burst-layer" aria-hidden="true">
      {bursts.map(id => (
        <div key={id} className="burst">
          {Array.from({ length: 18 }).map((_, i) => {
            const ang = (i / 18) * Math.PI * 2 + (id % 7);
            const dist = 70 + ((i * 37 + id) % 60);
            return (
              <motion.span
                key={i}
                className="coin"
                initial={{ x: 0, y: 0, scale: 0.4, opacity: 1, rotate: 0 }}
                animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist - 40, scale: 1, opacity: 0, rotate: 360 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Ring that fills with spending against the monthly limit. */
export function Ring({ pct }: { pct: number }) {
  const C = 263.9;
  const state = pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok';
  return (
    <div className={`ring ${state}`}>
      <svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--ring-a)" />
            <stop offset="1" stopColor="var(--ring-b)" />
          </linearGradient>
        </defs>
        <circle className="trk" cx="50" cy="50" r="42" />
        <motion.circle
          className="val" cx="50" cy="50" r="42"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - Math.min(1, pct)) }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <b className="num">{Math.round(pct * 100)}%</b>
    </div>
  );
}
