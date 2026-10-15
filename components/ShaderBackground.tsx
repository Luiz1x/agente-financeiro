'use client';

import { useEffect, useRef } from 'react';

/**
 * Animated WebGL background: flowing emerald / indigo / gold gradient,
 * a glow that follows the pointer and drifting sparkles.
 * Rendered at reduced resolution and capped at ~40fps so it stays light on phones.
 */

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `
precision mediump float;
uniform vec2 r;
uniform float t;
uniform vec2 m;
uniform float k;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main(){
  vec2 uv = gl_FragCoord.xy / r;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= r.x / r.y;

  float tt = t * 0.07;
  vec2 q = p * 1.5;
  for (int i = 1; i < 6; i++) {
    float fi = float(i);
    q += vec2(0.55 / fi * sin(fi * q.y + tt * (1.0 + fi * 0.15) + 0.3 * fi) + 0.25,
              0.55 / fi * sin(fi * q.x + tt * 1.25 + 0.6 * fi) - 0.2);
  }
  float a = 0.5 + 0.5 * sin(q.x + q.y);
  float b = 0.5 + 0.5 * cos(q.x * 1.3 - q.y * 0.8);

  vec3 base  = vec3(0.03, 0.045, 0.09);
  vec3 emer  = vec3(0.05, 0.42, 0.33);
  vec3 indi  = vec3(0.16, 0.20, 0.55);
  vec3 gold  = vec3(0.62, 0.42, 0.10);

  vec3 col = base;
  col += emer * pow(a, 2.5) * 0.9;
  col += indi * pow(b, 1.8) * 0.9;
  col += gold * pow(a * b, 3.0) * 1.25;

  // pointer glow
  vec2 mm = m / r;
  vec2 dv = uv - mm; dv.x *= r.x / r.y;
  col += vec3(0.95, 0.72, 0.35) * 0.16 * exp(-dot(dv, dv) * 9.0) * k;

  // sparkles drifting up
  vec2 g = (gl_FragCoord.xy + vec2(0.0, t * 9.0)) / (r.y * 0.075);
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id);
  vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
  float tw = 0.5 + 0.5 * sin(t * 1.7 + h * 50.0);
  float s = smoothstep(0.09, 0.0, length(f - off * 0.6)) * step(0.88, h) * tw;
  col += vec3(1.0, 0.88, 0.62) * s * 0.55;

  // vignette + grain
  col *= 1.0 - 0.3 * pow(length(uv - vec2(0.5, 0.45)), 1.8);
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.02;

  gl_FragColor = vec4(col, 1.0);
}`;

export default function ShaderBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) { canvas.classList.add('fallback'); return; }

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.classList.add('fallback'); return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uR = gl.getUniformLocation(prog, 'r');
    const uT = gl.getUniformLocation(prog, 't');
    const uM = gl.getUniformLocation(prog, 'm');
    const uK = gl.getUniformLocation(prog, 'k');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scale = Math.min(window.devicePixelRatio || 1, 2) * (window.innerWidth < 700 ? 0.42 : 0.55);

    let w = 0, h = 0;
    const resize = () => {
      w = Math.max(1, Math.floor(window.innerWidth * scale));
      h = Math.max(1, Math.floor(window.innerHeight * scale));
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    // pointer position, eased
    let tx = 0.5, ty = 0.65, mx = 0.5, my = 0.65, glow = 0.6, glowT = 0.6;
    const move = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth;
      ty = 1 - e.clientY / window.innerHeight;
      glowT = 1;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });

    let raf = 0, last = 0;
    const start = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 24) return; // ~40fps cap
      last = now;
      mx += (tx - mx) * 0.08; my += (ty - my) * 0.08; glow += (glowT - glow) * 0.05; glowT *= 0.995;
      gl.uniform2f(uR, w, h);
      gl.uniform1f(uT, (now - start) / 1000);
      gl.uniform2f(uM, mx * w, my * h);
      gl.uniform1f(uK, Math.max(0.45, glow));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const drawOnce = () => {
      gl.uniform2f(uR, w, h); gl.uniform1f(uT, 12); gl.uniform2f(uM, w * 0.5, h * 0.7); gl.uniform1f(uK, 0.6);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) raf = requestAnimationFrame(frame);
    };
    if (reduce) drawOnce(); else raf = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', vis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  return <canvas ref={ref} className="bg-canvas" aria-hidden="true" />;
}
