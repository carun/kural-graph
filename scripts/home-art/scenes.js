// The home page's pictures, painted on a canvas: dusk in the world the Kural talks about. There are no people in them.
// Runs in a browser page, driven by paint.mjs. Every scene is seeded, so a repaint gives the same picture.
(() => {
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const screen = (a, b) => [1 - (1 - a[0]) * (1 - b[0]), 1 - (1 - a[1]) * (1 - b[1]), 1 - (1 - a[2]) * (1 - b[2])];
  const ramp = (stops, t) => {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [p0, c0] = stops[i - 1];
        const [p1, c1] = stops[i];
        return mix(rgb(c0), rgb(c1), smooth(0, 1, (t - p0) / (p1 - p0)));
      }
    }
    return rgb(stops[stops.length - 1][1]);
  };

  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Smooth value noise, in fractal sums for clouds, water and grain of wood. */
  function noise(seed) {
    const R = random(seed);
    const S = 256;
    const g = new Float32Array(S * S);
    for (let i = 0; i < g.length; i++) g[i] = R();
    const at = (x, y) => g[(y & 255) * S + (x & 255)];
    const n = (x, y) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      let fx = x - xi;
      let fy = y - yi;
      fx = fx * fx * (3 - 2 * fx);
      fy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), fx), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), fx), fy);
    };
    const fbm = (x, y, oct = 5) => {
      let s = 0;
      let a = 0.5;
      let w = 0;
      for (let i = 0; i < oct; i++) {
        s += a * n(x, y);
        w += a;
        a *= 0.5;
        x = x * 2.03 + 17.3;
        y = y * 2.03 + 9.1;
      }
      return s / w;
    };
    return { n, fbm };
  }

  function layer(W, H) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c.getContext('2d');
  }

  // ── Sky ────────────────────────────────────────────────────────────────────────────────────────────
  /** A dusk sky down to the horizon: long flat strata, lit from the sun and dying away from it. */
  function sky(ctx, W, H, o) {
    const N = noise(o.seed);
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const [sx, sy] = o.sun;
    const glow = rgb(o.glow);
    const core = rgb(o.core);
    const dark = rgb(o.cloudDark);
    const lit = rgb(o.cloudLit);
    const asp = W / H;
    const rows = Math.min(H, Math.ceil(o.hy) + 3);
    for (let y = 0; y < rows; y++) {
      const v = clamp(y / o.hy);
      const base = ramp(o.stops, v);
      const m = smooth(o.cloudTop ?? 0.1, 0.5, v) * (1 - smooth(0.93, 1, v) * 0.7);
      for (let x = 0; x < W; x++) {
        const dx = (x - sx) / H;
        const dy = (y - sy) / H;
        const g = Math.exp(-(dx * dx * o.spread[0] + dy * dy * o.spread[1]));
        const c = Math.exp(-(dx * dx * 26 + dy * dy * 90));
        let col = screen(base, [glow[0] * g * o.amount, glow[1] * g * o.amount, glow[2] * g * o.amount]);
        col = screen(col, [core[0] * c * o.coreAmount, core[1] * c * o.coreAmount, core[2] * c * o.coreAmount]);
        const u = (x / W) * asp;
        const q = N.fbm(u * 0.9, v * 2.2, 3);
        const n = N.fbm(u * 1.5 + q * 0.5 + 7, v * (o.strata ?? 16) + q * 1.1, 6);
        const k = smooth(o.cloud[0], o.cloud[1], n) * m;
        const under = smooth(o.cloud[0] - 0.05, o.cloud[0] + 0.05, N.fbm(u * 1.5 + q * 0.5 + 7, (v + 0.012) * (o.strata ?? 16) + q * 1.1, 6));
        col = mix(col, mix(dark, lit, clamp((g * 1.25 + c) * (0.72 + 0.5 * (1 - under)))), k * o.cloudAlpha);
        // Haze away from the sun, so the far side falls into the dark the words sit on.
        const fall = o.fall ? 1 - o.fall * (1 - g) * smooth(0.1, 0.9, Math.abs(dx) * o.fallScale) : 1;
        const i = (y * W + x) * 4;
        d[i] = col[0] * fall * 255;
        d[i + 1] = col[1] * fall * 255;
        d[i + 2] = col[2] * fall * 255;
        d[i + 3] = 255;
      }
    }
    for (let y = rows; y < H; y++) for (let x = 0; x < W; x++) d[(y * W + x) * 4 + 3] = 255;
    ctx.putImageData(img, 0, 0);
  }

  function sun(ctx, x, y, r, inner, outer) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 5);
    halo.addColorStop(0, css(rgb(outer), 0.42));
    halo.addColorStop(0.35, css(rgb(outer), 0.12));
    halo.addColorStop(1, css(rgb(outer), 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    ctx.restore();
    const disc = ctx.createLinearGradient(0, y - r, 0, y + r);
    disc.addColorStop(0, inner);
    disc.addColorStop(1, outer);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /** A far line of low hills, ridged with noise. */
  function ridge(ctx, W, y, amp, colour, seed, freq = 3.5, H = y + 20) {
    const N = noise(seed);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 2) ctx.lineTo(x, y - amp * Math.pow(N.fbm((x / W) * freq, 0.5, 4), 1.6) * 2);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  // ── The palmyra ────────────────────────────────────────────────────────────────────────────────────
  /** One fan leaf: stiff leaflets spreading from the end of its stalk, their tips bowing under their own weight. */
  function fan(ctx, R, x, y, a, L, spread) {
    const k = Math.round(11 + R() * 5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j <= k; j++) {
      const t = j / k;
      const ang = a + (t - 0.5) * 2 * spread;
      const len = L * (0.72 + 0.28 * Math.sin(t * Math.PI)) * (0.88 + R() * 0.24);
      const bow = 0.16 * len * Math.abs(Math.cos(ang));
      const tx = x + Math.cos(ang) * len;
      const ty = y + Math.sin(ang) * len + bow;
      const mid = ang + spread / k;
      const nl = len * (0.3 + R() * 0.14);
      ctx.quadraticCurveTo(x + Math.cos(ang - 0.04) * len * 0.72, y + Math.sin(ang - 0.04) * len * 0.72, tx, ty);
      if (j < k) ctx.quadraticCurveTo(x + Math.cos(mid - 0.02) * len * 0.66, y + Math.sin(mid - 0.02) * len * 0.66 + bow * 0.5, x + Math.cos(mid) * nl, y + Math.sin(mid) * nl);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** A palmyra: the tall, straight palm whose leaves were the manuscripts. */
  function palm(ctx, R, x, y, h, colour, o = {}) {
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour;
    const lean = (o.lean ?? (R() - 0.5) * 0.08) * h;
    const cx = x + lean;
    const cy = y - h;
    const wb = h * 0.0245;
    const wt = h * 0.0125;
    ctx.beginPath();
    ctx.moveTo(x - wb * 1.5, y);
    ctx.bezierCurveTo(x - wb * 0.75, y - h * 0.12, x + lean * 0.4 - wt * 1.5, y - h * 0.55, cx - wt, cy);
    ctx.lineTo(cx + wt, cy);
    ctx.bezierCurveTo(x + lean * 0.4 + wt * 1.5, y - h * 0.55, x + wb * 0.75, y - h * 0.12, x + wb * 1.5, y);
    ctx.closePath();
    ctx.fill();
    const r = o.r ?? h * 0.145;
    // Dead leaves hang in a skirt below the crown.
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i / 4 - 0.5) * 1.5 + (R() - 0.5) * 0.2;
      fan(ctx, R, cx + Math.cos(a) * r * 0.2, cy + r * 0.1, a, r * (0.62 + R() * 0.2), 0.42);
    }
    // Back of the crown, then the sides, then the leaves that face you.
    const ring = (n, from, to, reach, size, spread) => {
      for (let i = 0; i < n; i++) {
        const a = lerp(from, to, (i + 0.5) / n) + (R() - 0.5) * 0.22;
        const s = r * reach * (0.8 + R() * 0.4);
        const ex = cx + Math.cos(a) * s;
        const ey = cy + Math.sin(a) * s * 0.9;
        ctx.lineWidth = Math.max(0.7, r * 0.022);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5 - r * 0.05, ex, ey);
        ctx.stroke();
        fan(ctx, R, ex, ey, a + (Math.cos(a) * 0.25), r * size * (0.85 + R() * 0.3), spread);
      }
    };
    ring(12, -Math.PI * 1.36, Math.PI * 0.36, 0.72, 0.7, 0.82);
    ring(7, -Math.PI * 1.16, Math.PI * 0.16, 0.42, 0.6, 0.95);
    ring(4, -Math.PI * 1.05, Math.PI * 0.05, 0.14, 0.42, 1.25);
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.02, r * 0.26, r * 0.2, 0, 0, TAU);
    ctx.fill();
  }

  /** Silhouettes pick up the sun on the side that faces it. */
  function lightFrom(ctxLayer, W, H, sx, sy, colour, reach, strength) {
    ctxLayer.save();
    ctxLayer.globalCompositeOperation = 'source-atop';
    const g = ctxLayer.createRadialGradient(sx, sy, 0, sx, sy, reach);
    g.addColorStop(0, css(rgb(colour), strength));
    g.addColorStop(1, css(rgb(colour), 0));
    ctxLayer.fillStyle = g;
    ctxLayer.fillRect(0, 0, W, H);
    ctxLayer.restore();
  }

  // ── Water ──────────────────────────────────────────────────────────────────────────────────────────
  /** Still water: everything above the horizon, mirrored and broken into long ripples that widen towards you. */
  function water(ctx, W, H, hy, o = {}) {
    const N = noise(o.seed ?? 5);
    const img = ctx.getImageData(0, 0, W, H);
    const src = new Uint8ClampedArray(img.data);
    const d = img.data;
    const y0 = Math.round(hy);
    const amp = (o.amp ?? 1) * (W / 1000);
    const deep = rgb(o.deep ?? '#0b0604');
    for (let y = y0; y < H; y++) {
      const t = (y - y0) / (H - y0);
      const sq = 0.1 + t * t * 1.4;
      const fall = lerp(o.near ?? 0.86, o.far ?? 0.32, Math.pow(t, 0.75));
      for (let x = 0; x < W; x++) {
        const a = N.fbm(x * 0.0035 / sq, y * 0.13 / sq, 3) - 0.5;
        const b = N.n(x * 0.012 / sq + 40, y * 0.42 / sq) - 0.5;
        const sxp = clamp(Math.round(x + a * amp * 90 * (0.1 + t)), 0, W - 1);
        const syp = clamp(Math.round(y0 - (y - y0) * (o.stretch ?? 1.15) + (a * 34 + b * 44) * amp * (0.12 + t * 1.5)), 0, y0 - 1);
        const i = (syp * W + sxp) * 4;
        const j = (y * W + x) * 4;
        const ripple = 1 + b * (o.ripple ?? 0.5);
        const k = Math.min(1, fall * ripple);
        d[j] = lerp(deep[0] * 255, src[i], k);
        d[j + 1] = lerp(deep[1] * 255, src[i + 1], k);
        d[j + 2] = lerp(deep[2] * 255, src[i + 2], k);
      }
    }
    ctx.putImageData(img, 0, 0);
    // The line where water meets land is never perfectly hard.
    const seam = ctx.createLinearGradient(0, hy - 1.5, 0, hy + 2.5);
    seam.addColorStop(0, 'rgba(0,0,0,0)');
    seam.addColorStop(0.5, 'rgba(10,5,3,0.45)');
    seam.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = seam;
    ctx.fillRect(0, hy - 2, W, 5);
  }

  /** A lotus leaf lying on the water, foreshortened, its veins catching the last light on one side. */
  function pad(ctx, R, x, y, rx, o = {}) {
    const ry = rx * (o.flat ?? 0.26);
    const notch = (o.notch ?? R() * TAU);
    const body = rgb(o.body ?? '#141509');
    const edge = rgb(o.edge ?? '#b5803a');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rx, notch + 0.1, notch + TAU - 0.1);
    ctx.closePath();
    const g = ctx.createRadialGradient(rx * 0.3, -rx * 0.4, rx * 0.1, 0, 0, rx);
    g.addColorStop(0, css(mix(body, edge, 0.34)));
    g.addColorStop(0.75, css(body));
    g.addColorStop(1, css(mix(body, [0, 0, 0], 0.4)));
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = rx * 0.12;
    ctx.shadowOffsetY = rx * 0.05;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = css(edge, 0.2);
    ctx.lineWidth = Math.max(0.6, rx * 0.008);
    for (let i = 0; i < 16; i++) {
      const a = notch + 0.25 + (i / 15) * (TAU - 0.5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * rx * 0.96, Math.sin(a) * rx * 0.96);
      ctx.stroke();
    }
    ctx.strokeStyle = css(edge, 0.62);
    ctx.lineWidth = Math.max(1, rx * 0.016);
    ctx.beginPath();
    ctx.arc(0, 0, rx - 0.5, -2.7, 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function petal(ctx, x, y, len, wid, rot, p) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const path = new Path2D();
    path.moveTo(0, 0);
    path.bezierCurveTo(-wid * 0.62, -len * 0.14, -wid * 0.58, -len * 0.7, 0, -len);
    path.bezierCurveTo(wid * 0.58, -len * 0.7, wid * 0.62, -len * 0.14, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, p.base);
    g.addColorStop(0.42, p.mid);
    g.addColorStop(0.86, p.tip);
    g.addColorStop(1, p.edge);
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    // Shade one side, so each petal turns away from the next.
    const s = ctx.createLinearGradient(-wid * 0.6, 0, wid * 0.6, 0);
    s.addColorStop(0, 'rgba(40,6,24,0.34)');
    s.addColorStop(0.5, 'rgba(40,6,24,0)');
    s.addColorStop(1, 'rgba(255,214,190,0.14)');
    ctx.fillStyle = s;
    ctx.fillRect(-wid, -len, wid * 2, len);
    ctx.strokeStyle = 'rgba(70,14,40,0.18)';
    ctx.lineWidth = Math.max(0.5, len * 0.006);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * wid * 0.03, -len * 0.04);
      ctx.quadraticCurveTo(i * wid * 0.17, -len * 0.55, i * wid * 0.03, -len * 0.97);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = p.line;
    ctx.lineWidth = Math.max(0.6, len * 0.009);
    ctx.stroke(path);
    ctx.restore();
  }

  const ROSE = { base: '#2c0f14', mid: '#80322f', tip: '#dd8150', edge: '#ffcf8c', line: 'rgba(255,190,120,0.34)' };
  const ROSE_FRONT = { base: '#3a1418', mid: '#9c4640', tip: '#ec9a62', edge: '#ffdca4', line: 'rgba(255,205,140,0.42)' };

  function lotus(ctx, R, x, y, s, a = ROSE, b = ROSE_FRONT) {
    const glow = ctx.createRadialGradient(x, y - s * 0.5, 0, x, y - s * 0.5, s * 1.5);
    glow.addColorStop(0, 'rgba(255,170,100,0.2)');
    glow.addColorStop(1, 'rgba(255,190,130,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - s * 1.6, y - s * 2.1, s * 3.2, s * 3.2);
    const j = () => (R() - 0.5) * 0.05;
    for (const r of [-1.05, 1.05, -0.74, 0.74, -0.42, 0.42, -0.14, 0.14]) petal(ctx, x, y, s * (1.04 - Math.abs(r) * 0.08), s * 0.56, r + j(), a);
    const seed = ctx.createRadialGradient(x, y - s * 0.34, 0, x, y - s * 0.34, s * 0.4);
    seed.addColorStop(0, 'rgba(255,214,120,0.9)');
    seed.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = seed;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.34, s * 0.42, 0, TAU);
    ctx.fill();
    for (const r of [-0.56, 0.56, -0.2, 0.2]) petal(ctx, x, y, s * 0.82, s * 0.56, r + j(), b);
    for (const r of [-1.42, 1.42, -0.98, 0.98]) petal(ctx, x, y + s * 0.02, s * 0.76, s * 0.5, r + j(), b);
    for (const r of [-1.86, 1.86]) petal(ctx, x, y + s * 0.03, s * 0.56, s * 0.34, r + j(), a);
  }

  function bud(ctx, x, y, s, rot, p = ROSE) {
    petal(ctx, x, y, s, s * 0.52, rot - 0.13, p);
    petal(ctx, x, y, s, s * 0.52, rot + 0.13, p);
    petal(ctx, x, y, s * 0.96, s * 0.56, rot, ROSE_FRONT);
  }

  function stem(ctx, x0, y0, x1, y1, bend, w) {
    ctx.strokeStyle = '#1b130c';
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(lerp(x0, x1, 0.5) + bend, lerp(y0, y1, 0.5), x1, y1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(214,150,80,0.36)';
    ctx.lineWidth = Math.max(0.6, w * 0.3);
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.3, y0);
    ctx.quadraticCurveTo(lerp(x0, x1, 0.5) + bend + w * 0.3, lerp(y0, y1, 0.5), x1 + w * 0.3, y1);
    ctx.stroke();
  }

  /** Grain, and a slow falling away at the edges. The grain also stops the dark gradients banding. */
  function finish(ctx, W, H, o = {}) {
    const R = random(o.seed ?? 99);
    const N = noise((o.seed ?? 99) + 3);
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const g = (o.grain ?? 0.016) * 255;
    const vig = o.vignette ?? 0.3;
    const wash = o.wash ?? 0.1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const dx = x / W - 0.5;
        const dy = y / H - 0.5;
        const m = 1 + wash * (N.fbm(x * 0.006, y * 0.014, 4) - 0.5) + wash * 0.5 * (N.fbm(x * 0.05 + 3, y * 0.09, 3) - 0.5);
        const k = (1 - vig * smooth(0.2, 0.75, dx * dx * 1.7 + dy * dy * 1.7)) * m;
        const n = (R() + R() - 1) * g;
        d[i] = d[i] * k + n;
        d[i + 1] = d[i + 1] * k + n;
        d[i + 2] = d[i + 2] * k + n;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Birds going home, in a loose line. */
  function birds(ctx, R, x, y, s, n) {
    ctx.strokeStyle = 'rgba(20,10,6,0.82)';
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const bx = x + i * s * 4.2 + (R() - 0.5) * s * 3;
      const by = y - i * s * 0.9 + (R() - 0.5) * s * 3.4;
      const w = s * (0.75 + R() * 0.5);
      const f = 0.3 + R() * 0.5;
      ctx.lineWidth = Math.max(0.8, s * 0.2);
      ctx.beginPath();
      ctx.moveTo(bx - w * 1.1, by - w * f * 0.7);
      ctx.quadraticCurveTo(bx - w * 0.45, by - w * f, bx, by);
      ctx.quadraticCurveTo(bx + w * 0.45, by - w * f, bx + w * 1.1, by - w * f * 0.7);
      ctx.stroke();
    }
  }

  // ── Dusk over the lotus pond ───────────────────────────────────────────────────────────────────────
  const DUSK = {
    stops: [[0, '#0f0805'], [0.34, '#26120a'], [0.62, '#55260f'], [0.84, '#a2521e'], [1, '#e08a3c']],
    glow: '#e8742a',
    core: '#ffb765',
    cloudDark: '#2a140b',
    cloudLit: '#d98a48',
    cloud: [0.47, 0.64],
    cloudAlpha: 0.7,
    coreAmount: 0.7,
  };

  function pond(ctx, W, H, o) {
    const R = random(o.seed);
    const hy = H * o.horizon;
    const sx = W * o.sunX;
    const r = H * o.sunR;
    sky(ctx, W, H, { ...DUSK, seed: o.seed, hy, sun: [sx, hy - r * 0.2], spread: o.spread, amount: o.amount, fall: o.fall, fallScale: o.fallScale });
    sun(ctx, sx, hy - r * 0.15, r, '#ffe6b0', '#ff9f4a');
    ridge(ctx, W, hy + 1, H * 0.018, '#6b3216', 2, 3.6, hy + 2);
    ridge(ctx, W, hy + 1, H * 0.011, '#401e0e', 3, 5.4, hy + 2);
    // The far row, thinned by distance, and the near palms on their spit of land.
    const far = layer(W, H);
    for (const [x, h] of o.farPalms) palm(far, R, W * x, hy + 1, H * h, '#4b2412');
    ctx.drawImage(far.canvas, 0, 0);
    const near = layer(W, H);
    near.fillStyle = '#120906';
    near.beginPath();
    near.moveTo(W * o.bank[0], hy + 2);
    near.quadraticCurveTo(W * lerp(o.bank[0], 1, 0.3), hy - H * 0.012, W * lerp(o.bank[0], 1, 0.6), hy - H * 0.014);
    near.lineTo(W, hy - H * 0.018);
    near.lineTo(W, hy + 2);
    near.closePath();
    near.fill();
    for (const [x, h, rr] of o.palms) palm(near, R, W * x, hy, H * h, '#120906', rr ? { r: H * rr } : {});
    lightFrom(near, W, H, sx, hy - r, '#b4561f', H * 0.42, 0.4);
    ctx.drawImage(near.canvas, 0, 0);
    birds(ctx, R, W * o.birds[0], H * o.birds[1], H * 0.0085, 9);
    water(ctx, W, H, hy, { seed: o.seed + 1, far: 0.3, near: 0.92, stretch: 1.05, ripple: 0.34 });
    const mist = ctx.createLinearGradient(0, hy - H * 0.02, 0, hy + H * 0.05);
    mist.addColorStop(0, 'rgba(240,150,80,0)');
    mist.addColorStop(0.4, 'rgba(240,150,80,0.12)');
    mist.addColorStop(1, 'rgba(240,150,80,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, hy - H * 0.02, W, H * 0.07);
    // Leaves first, far to near, then the flowers that stand above them.
    const pads = [...o.pads].sort((a, b) => a[1] - b[1]);
    for (const [x, y, s] of pads) pad(ctx, R, W * x, H * y, H * s, { notch: 0.9 + R() * 1.4 });
    for (const [x, y, s, stemFrom, lean] of o.buds) {
      stem(ctx, W * stemFrom[0], H * stemFrom[1], W * x, H * y, W * 0.006, Math.max(1.3, H * 0.0034));
      bud(ctx, W * x, H * y, H * s, lean);
    }
    const [fx, fy, fs, from] = o.flower;
    stem(ctx, W * from[0], H * from[1], W * fx, H * fy, -W * 0.012, Math.max(1.8, H * 0.005));
    lotus(ctx, R, W * fx, H * fy, H * fs);
    finish(ctx, W, H, { seed: o.seed, vignette: 0.22, grain: 0.015 });
  }

  const SCENES = {
    hero(ctx, W, H) {
      pond(ctx, W, H, {
        seed: 11,
        horizon: 0.735,
        sunX: 0.618,
        sunR: 0.034,
        spread: [2.2, 11],
        birds: [0.47, 0.5],
        amount: 0.82,
        fall: 0.72,
        fallScale: 1.15,
        bank: [0.72, 1],
        farPalms: [[0.385, 0.075], [0.42, 0.098], [0.452, 0.07], [0.5, 0.088], [0.532, 0.066]],
        palms: [[0.815, 0.27], [0.852, 0.4], [0.898, 0.32], [0.962, 0.45]],
        pads: [[0.6, 0.79, 0.034], [0.665, 0.83, 0.052], [0.765, 0.806, 0.04], [0.86, 0.845, 0.062], [0.925, 0.905, 0.085], [0.735, 0.925, 0.078], [0.58, 0.905, 0.06], [0.84, 0.98, 0.11]],
        buds: [[0.665, 0.778, 0.042, [0.672, 0.835], -0.1], [0.826, 0.742, 0.046, [0.82, 0.846], 0.12]],
        flower: [0.748, 0.8, 0.086, [0.738, 0.92]],
      });
    },
    heroPortrait(ctx, W, H) {
      pond(ctx, W, H, {
        seed: 12,
        horizon: 0.75,
        sunX: 0.42,
        sunR: 0.0235,
        spread: [3.4, 15],
        birds: [0.32, 0.6],
        amount: 0.86,
        fall: 0.42,
        fallScale: 1.4,
        bank: [0.66, 1],
        farPalms: [[0.14, 0.07], [0.19, 0.085], [0.23, 0.062], [0.3, 0.075]],
        palms: [[0.72, 0.125], [0.78, 0.185], [0.87, 0.155]],
        pads: [[0.3, 0.8, 0.032], [0.47, 0.83, 0.042], [0.72, 0.815, 0.036], [0.84, 0.87, 0.052], [0.33, 0.9, 0.056], [0.62, 0.945, 0.07], [0.9, 0.96, 0.06]],
        buds: [[0.405, 0.795, 0.036, [0.45, 0.838], -0.12], [0.8, 0.777, 0.04, [0.74, 0.828], 0.12]],
        flower: [0.615, 0.815, 0.078, [0.6, 0.925]],
      });
    },
  };

  // ── The palm leaves ────────────────────────────────────────────────────────────────────────────────
  /** A dark teak board, its grain running along the length of the leaves. */
  function wood(ctx, W, H, seed, tone = ['#1a0e07', '#3a2010', '#5b3518']) {
    const N = noise(seed);
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const a = rgb(tone[0]);
    const b = rgb(tone[1]);
    const c = rgb(tone[2]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const warp = N.fbm(x * 0.0016, y * 0.006, 3) * 26;
        const ring = 0.5 + 0.5 * Math.sin((y * 0.05 + warp) * 2.4);
        const fine = N.fbm(x * 0.006, y * 0.34, 3);
        const t = clamp(ring * 0.4 + fine * 0.8 - 0.1);
        const col = t < 0.5 ? mix(a, b, t * 2) : mix(b, c, (t - 0.5) * 2);
        const i = (y * W + x) * 4;
        d[i] = col[0] * 255;
        d[i + 1] = col[1] * 255;
        d[i + 2] = col[2] * 255;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** One olai: a long thin strip of palm leaf, matte and straw-coloured, with a couplet cut into it and rubbed dark. */
  function olai(ctx, R, cx, cy, L, T, rot, lines, o = {}) {
    const lift = o.lift ?? 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const leaf = new Path2D();
    leaf.roundRect(-L / 2, -T / 2, L, T, [T * 0.3, T * 0.22, T * 0.26, T * 0.32]);
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = lift * 2.2;
    ctx.shadowOffsetY = lift;
    ctx.fillStyle = o.tone ?? '#c6ab7b';
    ctx.fill(leaf);
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.clip(leaf);
    // The fibres run the length of the leaf.
    for (let i = 0; i < T * 3; i++) {
      const y = -T / 2 + R() * T;
      const x0 = -L / 2 + R() * L * 0.8;
      ctx.strokeStyle = R() < 0.62 ? `rgba(88,60,28,${0.05 + R() * 0.13})` : `rgba(246,228,190,${0.05 + R() * 0.1})`;
      ctx.lineWidth = 0.4 + R() * 0.7;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + L * (0.05 + R() * 0.3), y + (R() - 0.5) * 1.1);
      ctx.stroke();
    }
    // Age: brown at the ends, along the edges, and in a few soft stains.
    const ends = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
    ends.addColorStop(0, 'rgba(58,32,12,0.72)');
    ends.addColorStop(0.07, 'rgba(58,32,12,0.08)');
    ends.addColorStop(0.92, 'rgba(58,32,12,0.08)');
    ends.addColorStop(1, 'rgba(58,32,12,0.72)');
    ctx.fillStyle = ends;
    ctx.fillRect(-L / 2, -T / 2, L, T);
    const edge = ctx.createLinearGradient(0, -T / 2, 0, T / 2);
    edge.addColorStop(0, 'rgba(70,40,14,0.34)');
    edge.addColorStop(0.16, 'rgba(70,40,14,0)');
    edge.addColorStop(0.84, 'rgba(70,40,14,0)');
    edge.addColorStop(1, 'rgba(50,28,10,0.46)');
    ctx.fillStyle = edge;
    ctx.fillRect(-L / 2, -T / 2, L, T);
    for (let i = 0; i < 7; i++) {
      const sx = (R() - 0.5) * L;
      const sy = (R() - 0.5) * T;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, T * (0.5 + R() * 1.1));
      g.addColorStop(0, 'rgba(84,50,20,0.22)');
      g.addColorStop(1, 'rgba(84,50,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-L / 2, -T / 2, L, T);
    }
    // Cut into the leaf: a dark stroke, with a lit lip below it.
    const size = o.size ?? T * 0.25;
    ctx.font = `400 ${size}px "Noto Serif Tamil"`;
    ctx.textBaseline = 'middle';
    const left = -L / 2 + L * 0.135;
    lines.forEach((line, i) => {
      const y = (i - (lines.length - 1) / 2) * size * 1.5;
      ctx.fillStyle = 'rgba(250,234,200,0.42)';
      ctx.fillText(line, left + 0.5, y + 0.8);
      ctx.fillStyle = 'rgba(40,22,10,0.88)';
      ctx.fillText(line, left, y);
    });
    ctx.restore();
    // The thread holes.
    for (const hx of o.holes ?? []) {
      ctx.fillStyle = '#1a0c06';
      ctx.beginPath();
      ctx.arc(hx, 0, T * 0.075, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7d2a17';
      ctx.beginPath();
      ctx.arc(hx, 0, T * 0.038, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  Object.assign(SCENES, {
    leaves(ctx, W, H, data) {
      const R = random(21);
      wood(ctx, W, H, 23);
      const shade = ctx.createRadialGradient(W * 0.6, H * 0.36, H * 0.08, W * 0.54, H * 0.5, W * 0.7);
      shade.addColorStop(0, 'rgba(255,160,80,0.14)');
      shade.addColorStop(0.45, 'rgba(0,0,0,0.2)');
      shade.addColorStop(1, 'rgba(5,2,1,0.86)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
      const L = W * 0.9;
      const T = H * 0.128;
      const tilt = -0.055;
      const hole = L * 0.415;
      ctx.save();
      ctx.translate(W * 0.505, H * 0.5);
      ctx.rotate(tilt);
      // The bundle's cover boards, and the pile of leaves under the ones you can read.
      for (const [dy, rot] of [[H * 0.26, 0.008], [-H * 0.3, -0.01]]) {
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 9;
        ctx.fillStyle = '#2a170b';
        ctx.save();
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.roundRect(-L * 0.507, dy - T * 0.42, L * 1.014, T * 0.84, 7);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(190,120,60,0.2)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      // A red cord passes down through the holes, under the leaves, and is left trailing off the top.
      const cord = (x0, y0, x1, y1, cx, cy) => {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(20,8,3,0.5)';
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        ctx.moveTo(x0 + 1, y0 + 3);
        ctx.quadraticCurveTo(cx + 1, cy + 3, x1 + 1, y1 + 3);
        ctx.stroke();
        ctx.strokeStyle = '#8a2c18';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(244,150,110,0.42)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x0, y0 - 0.8);
        ctx.quadraticCurveTo(cx, cy - 0.8, x1, y1 - 0.8);
        ctx.stroke();
      };
      for (const side of [-1, 1]) {
        const hx = W * 0.505 + side * hole * Math.cos(tilt);
        const hy = H * 0.5 + side * hole * Math.sin(tilt);
        cord(hx + T * 2 * Math.sin(tilt) * -1, hy - T * 2.05, hx - T * 2 * Math.sin(tilt) * -1, hy + T * 2.05, hx, hy);
      }
      {
        const hx = W * 0.505 - hole * Math.cos(tilt);
        const hy = H * 0.5 - hole * Math.sin(tilt);
        cord(hx + T * 2 * Math.sin(-tilt), hy - T * 2, W * 0.015, -8, W * 0.09, H * 0.02);
      }
      const rows = [-1.5, -0.5, 0.5, 1.5];
      rows.forEach((k, i) => {
        const y = H * 0.5 + k * T * 1.06 + (i % 2 ? 2 : -2);
        const x = W * 0.505 + [-5, 7, -3, 5][i] + (y - H * 0.5) * Math.sin(-tilt);
        olai(ctx, R, x, y, L, T, tilt + [0.004, -0.004, 0.005, -0.003][i], data.couplets[i], { size: T * 0.25, holes: [-hole, hole], tone: ['#c9b083', '#c2a777', '#cbb387', '#bea473'][i], lift: 4 });
      });
      // The iron stylus they were cut with.
      ctx.save();
      ctx.translate(W * 0.665, H * 0.905);
      ctx.rotate(-0.13);
      const sl = W * 0.44;
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 5;
      const iron = ctx.createLinearGradient(0, -4, 0, 4);
      iron.addColorStop(0, '#574a3d');
      iron.addColorStop(0.42, '#a8977d');
      iron.addColorStop(1, '#241d16');
      ctx.fillStyle = iron;
      ctx.beginPath();
      ctx.moveTo(-sl / 2, 0);
      ctx.lineTo(-sl * 0.4, -3.2);
      ctx.lineTo(sl * 0.47, -3.8);
      ctx.quadraticCurveTo(sl * 0.5, 0, sl * 0.47, 3.8);
      ctx.lineTo(-sl * 0.4, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      finish(ctx, W, H, { seed: 24, vignette: 0.42, grain: 0.016, wash: 0.08 });
    },

    // ── The whole book as a night sky: the real graph, its positions from the map, turned into stars ─────
    nightWide(ctx, W, H, data) {
      night(ctx, W, H, data, { seed: 31, horizon: 0.905, cx: 0.5, cy: 0.42, fitX: 0.45, fitY: 0.41, palms: [[0.038, 0.4], [0.082, 0.27], [0.91, 0.24], [0.965, 0.42]] });
    },
    night(ctx, W, H, data) {
      night(ctx, W, H, data, { seed: 32, horizon: 0.895, cx: 0.5, cy: 0.42, fitX: 0.46, fitY: 0.41, palms: [[0.05, 0.3], [0.95, 0.36]] });
    },

    // ── Part 1: the rain the second chapter praises, coming over a flooded field ─────────────────────────
    rain(ctx, W, H) {
      const R = random(41);
      const hy = H * 0.5;
      const sx = W * 0.72;
      sky(ctx, W, H, {
        seed: 41, hy, sun: [sx, hy - H * 0.02], spread: [3, 26], amount: 0.72, coreAmount: 0.3, strata: 9, cloudTop: 0,
        stops: [[0, '#120d0c'], [0.46, '#2a1d17'], [0.76, '#6a4426'], [0.92, '#c47c30'], [1, '#f5b564']],
        glow: '#e8842e', core: '#ffb060', cloudDark: '#17100e', cloudLit: '#b6703a', cloud: [0.42, 0.62], cloudAlpha: 0.84,
      });
      // Curtains of rain falling out of the cloud.
      const cur = layer(W, H);
      for (let i = 0; i < 9; i++) {
        const x = W * (0.02 + R() * 0.96);
        const w = W * (0.06 + R() * 0.14);
        const g = cur.createLinearGradient(0, H * 0.1, 0, hy);
        g.addColorStop(0, 'rgba(26,22,24,0)');
        g.addColorStop(0.7, `rgba(40,34,34,${0.22 + R() * 0.3})`);
        g.addColorStop(1, 'rgba(40,34,34,0.12)');
        cur.fillStyle = g;
        cur.beginPath();
        cur.moveTo(x, H * 0.1);
        cur.lineTo(x + w, H * 0.1);
        cur.lineTo(x + w - W * 0.05, hy);
        cur.lineTo(x - W * 0.05, hy);
        cur.closePath();
        cur.fill();
      }
      ctx.filter = 'blur(14px)';
      ctx.drawImage(cur.canvas, 0, 0);
      ctx.filter = 'none';
      ridge(ctx, W, hy + 1, H * 0.02, '#2d1e14', 42, 3, hy + 2);
      const t = layer(W, H);
      for (const [x, h] of [[0.1, 0.27], [0.165, 0.19], [0.24, 0.23], [0.89, 0.17]]) palm(t, R, W * x, hy + 1, H * h, '#140c09');
      ctx.drawImage(t.canvas, 0, 0);
      water(ctx, W, H, hy, { seed: 43, far: 0.56, near: 0.96, stretch: 0.85, amp: 0.8, ripple: 0.26, deep: '#140c07' });
      // Rows of young rice, closing on a point at the horizon.
      const vx = W * 0.6;
      for (let k = 0; k < 40; k++) {
        const dth = Math.pow(k / 39, 2);
        for (let row = -34; row <= 34; row++) {
          const y = hy + 3 + (H - hy) * 1.04 * dth;
          const x = vx + row * (W * 0.008 + dth * W * 0.092) + (R() - 0.5) * 5 * (0.3 + dth);
          if (x < -40 || x > W + 40) continue;
          const s = 3 + dth * 62;
          ctx.strokeStyle = css(mix(rgb('#6f6a2c'), rgb('#141a0c'), Math.pow(dth, 0.6)), 0.95);
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(0.6, 0.5 + dth * 2.6);
          const blades = 3 + Math.floor(dth * 5);
          for (let b = 0; b < blades; b++) {
            const lean = (b / (blades - 1 || 1) - 0.5) * 1.3 + (R() - 0.5) * 0.3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + lean * s * 0.15, y - s * 0.7, x + lean * s * 0.7, y - s * (0.86 + R() * 0.3));
            ctx.stroke();
          }
          if (dth > 0.12) {
            ctx.strokeStyle = 'rgba(248,190,120,0.34)';
            ctx.lineWidth = Math.max(0.5, dth * 1.3);
            ctx.beginPath();
            ctx.moveTo(x + 1, y);
            ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.7, x + s * 0.36, y - s * 0.9);
            ctx.stroke();
          }
        }
      }
      // Rings where the drops land, then the rain itself: fine and far, then a few heavy and near.
      for (let i = 0; i < 70; i++) {
        const t2 = Math.pow(R(), 1.5);
        const y = hy + 8 + (H - hy) * t2;
        const rx = 2 + t2 * 13;
        ctx.strokeStyle = `rgba(255,216,160,${0.05 + R() * 0.13})`;
        ctx.lineWidth = 0.6 + t2 * 0.5;
        ctx.beginPath();
        ctx.ellipse(R() * W, y, rx, rx * 0.26, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.lineCap = 'round';
      for (let i = 0; i < 1300; i++) {
        const near = R() < 0.1;
        const x = R() * W * 1.2 - W * 0.1;
        const y = R() * H;
        const len = near ? 60 + R() * 80 : 22 + R() * 44;
        ctx.strokeStyle = `rgba(255,222,176,${near ? 0.09 + R() * 0.14 : 0.04 + R() * 0.08})`;
        ctx.lineWidth = near ? 1 : 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.2, y + len);
        ctx.stroke();
      }
      finish(ctx, W, H, { seed: 44, vignette: 0.34, grain: 0.015 });
    },

    // ── Part 2: ripe rice at the end of the day ─────────────────────────────────────────────────────────
    rice(ctx, W, H) {
      const R = random(51);
      const hy = H * 0.66;
      const sx = W * 0.62;
      const sy = hy - H * 0.1;
      sky(ctx, W, H, {
        seed: 51, hy, sun: [sx, sy], spread: [2.6, 9], amount: 0.86, coreAmount: 0.8, strata: 12,
        stops: [[0, '#21100a'], [0.5, '#6b3013'], [0.8, '#c0701f'], [1, '#f2b257']],
        glow: '#ef8b2c', core: '#ffc978', cloudDark: '#3c1c0e', cloudLit: '#f0a95c', cloud: [0.47, 0.66], cloudAlpha: 0.66,
      });
      sun(ctx, sx, sy, H * 0.075, '#ffecbc', '#ffa850');
      ridge(ctx, W, hy, H * 0.03, '#874a1c', 52, 3, hy + 2);
      const t = layer(W, H);
      for (const [x, h] of [[0.08, 0.2], [0.14, 0.27], [0.86, 0.23], [0.93, 0.17]]) palm(t, R, W * x, hy + 1, H * h, '#55290f');
      ctx.drawImage(t.canvas, 0, 0);
      // The field, gold and going dark towards you.
      const f = ctx.createLinearGradient(0, hy, 0, H);
      f.addColorStop(0, '#c98a34');
      f.addColorStop(0.22, '#8b5519');
      f.addColorStop(0.7, '#351c0b');
      f.addColorStop(1, '#170b05');
      ctx.fillStyle = f;
      ctx.fillRect(0, hy, W, H - hy);

      const stalk = (x, base, h, c, rim, w) => {
        const dir = R() < 0.7 ? 1 : -1;
        const bend = (0.04 + R() * 0.1) * h * dir;
        const tx = x + bend;
        const ty = base - h;
        ctx.strokeStyle = c;
        ctx.fillStyle = c;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.quadraticCurveTo(x + bend * 0.08, base - h * 0.6, tx, ty);
        ctx.stroke();
        // Two long tapering leaves.
        for (let i = 0; i < 2; i++) {
          const ly = base - h * (0.22 + R() * 0.36);
          const lx = x + bend * 0.1;
          const side = i ? dir : -dir;
          const tipX = lx + side * h * (0.12 + R() * 0.16);
          const tipY = ly - h * (0.16 + R() * 0.3);
          ctx.beginPath();
          ctx.moveTo(lx - w * 0.5, ly);
          ctx.quadraticCurveTo(lerp(lx, tipX, 0.34), lerp(ly, tipY, 0.84), tipX, tipY);
          ctx.quadraticCurveTo(lerp(lx, tipX, 0.42), lerp(ly, tipY, 0.72), lx + w * 0.5, ly + h * 0.012);
          ctx.closePath();
          ctx.fill();
        }
        // The ear: a thin stem hanging over under its own weight, the grains close along it.
        let gx = tx;
        let gy = ty;
        let ang = -Math.PI / 2 + dir * 0.55;
        const n = 11 + Math.floor(R() * 6);
        const step = h * 0.0185;
        const size = h * 0.0145;
        for (let i = 0; i < n; i++) {
          ang += dir * (0.2 - i * 0.004);
          gx += Math.cos(ang) * step;
          gy += Math.sin(ang) * step;
          const taper = 1 - (i / n) * 0.42;
          for (const side of [-1, 1]) {
            const off = size * 0.62 * taper;
            const px = gx + Math.cos(ang + (side * Math.PI) / 2) * off;
            const py = gy + Math.sin(ang + (side * Math.PI) / 2) * off;
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(px, py, size * taper, size * 0.5 * taper, ang + side * 0.42, 0, TAU);
            ctx.fill();
            if (rim) {
              ctx.fillStyle = rim;
              ctx.beginPath();
              ctx.ellipse(px, py - size * 0.2, size * 0.6 * taper, size * 0.18 * taper, ang + side * 0.42, 0, TAU);
              ctx.fill();
            }
          }
        }
      };
      // Far stalks soft and lit, near ones dark and sharp.
      const rows = [
        { n: 190, base: [0.72, 0.8], h: [0.08, 0.12], c: '#9c6322', rim: null, w: 0.9, blur: 1.2 },
        { n: 120, base: [0.82, 0.95], h: [0.2, 0.3], c: '#5f3512', rim: 'rgba(255,190,110,0.32)', w: 1.2, blur: 0.5 },
        { n: 40, base: [1.0, 1.08], h: [0.42, 0.58], c: '#190c05', rim: 'rgba(255,186,100,0.6)', w: 1.7, blur: 0 },
      ];
      for (const row of rows) {
        const l = layer(W, H);
        const real = ctx;
        ctx = l;
        for (let i = 0; i < row.n; i++) stalk(R() * W * 1.08 - W * 0.04, H * lerp(row.base[0], row.base[1], R()), H * lerp(row.h[0], row.h[1], R()), row.c, row.rim, row.w);
        ctx = real;
        ctx.filter = row.blur ? `blur(${row.blur}px)` : 'none';
        ctx.drawImage(l.canvas, 0, 0);
        ctx.filter = 'none';
      }
      finish(ctx, W, H, { seed: 54, vignette: 0.3, grain: 0.014 });
    },

    // ── Part 3: the evening the lovers dread, a full moon rising over the pond ──────────────────────────
    moon(ctx, W, H) {
      const R = random(61);
      const hy = H * 0.63;
      const mx = W * 0.68;
      const my = H * 0.3;
      const mr = H * 0.112;
      sky(ctx, W, H, {
        seed: 61, hy, sun: [mx, my], spread: [2.4, 5], amount: 0.42, coreAmount: 0.34, strata: 13,
        stops: [[0, '#0e0810'], [0.45, '#2a1420'], [0.72, '#6a2b34'], [0.9, '#b65636'], [1, '#ee9548']],
        glow: '#b0705a', core: '#f6dcc4', cloudDark: '#20101a', cloudLit: '#c88e7c', cloud: [0.48, 0.67], cloudAlpha: 0.66,
      });
      for (let i = 0; i < 180; i++) {
        const y = R() * hy * 0.7;
        ctx.fillStyle = `rgba(255,240,226,${0.14 + R() * 0.5})`;
        ctx.beginPath();
        ctx.arc(R() * W, y, 0.4 + R() * 0.8, 0, TAU);
        ctx.fill();
      }
      // The moon: pale gold with the soft marks of its seas.
      const N = noise(62);
      const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.4);
      halo.addColorStop(0, 'rgba(255,226,198,0.34)');
      halo.addColorStop(0.3, 'rgba(240,190,180,0.1)');
      halo.addColorStop(1, 'rgba(240,190,180,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);
      const moon = ctx.getImageData(mx - mr - 2, my - mr - 2, mr * 2 + 4, mr * 2 + 4);
      const mw = moon.width;
      for (let y = 0; y < moon.height; y++) {
        for (let x = 0; x < mw; x++) {
          const dx = (x - mr - 2) / mr;
          const dy = (y - mr - 2) / mr;
          const rr = Math.hypot(dx, dy);
          const edge = 1 - smooth(0.975, 1.01, rr);
          if (edge <= 0) continue;
          const seas = smooth(0.46, 0.66, N.fbm(dx * 1.7 + 4, dy * 1.7 + 2, 5));
          const fine = N.fbm(dx * 9, dy * 9, 3);
          const shade = 1 - 0.12 * rr * rr;
          const col = mix(rgb('#ffeccb'), rgb('#e8c08e'), seas * 0.6 + (fine - 0.5) * 0.14);
          const i = (y * mw + x) * 4;
          moon.data[i] = lerp(moon.data[i], col[0] * shade * 255, edge);
          moon.data[i + 1] = lerp(moon.data[i + 1], col[1] * shade * 255, edge);
          moon.data[i + 2] = lerp(moon.data[i + 2], col[2] * shade * 255, edge);
        }
      }
      ctx.putImageData(moon, mx - mr - 2, my - mr - 2);
      ridge(ctx, W, hy + 1, H * 0.016, '#38182a', 63, 4, hy + 2);
      const t = layer(W, H);
      for (const [x, h] of [[0.06, 0.32], [0.13, 0.23], [0.22, 0.27], [0.94, 0.16]]) palm(t, R, W * x, hy + 1, H * h, '#150a16');
      ctx.drawImage(t.canvas, 0, 0);
      water(ctx, W, H, hy, { seed: 64, far: 0.3, near: 0.9, stretch: 1.1, ripple: 0.34, deep: '#090510' });
      const lily = { base: '#2b0f1c', mid: '#7f3546', tip: '#d58a74', edge: '#ffdcb4', line: 'rgba(255,214,180,0.34)' };
      const lilyF = { base: '#38151f', mid: '#984857', tip: '#e6a286', edge: '#ffe6c6', line: 'rgba(255,224,190,0.42)' };
      for (const [x, y, s] of [[0.14, 0.75, 0.07], [0.66, 0.74, 0.05], [0.86, 0.82, 0.09], [0.5, 0.885, 0.1], [0.22, 0.95, 0.13]]) pad(ctx, R, W * x, H * y, H * s, { body: '#120c12', edge: '#c0846a', notch: 1.1 });
      stem(ctx, W * 0.36, H * 0.86, W * 0.355, H * 0.74, W * 0.006, 3);
      pad(ctx, R, W * 0.35, H * 0.86, H * 0.08, { body: '#120c12', edge: '#c0846a', notch: 1.2 });
      lotus(ctx, R, W * 0.345, H * 0.76, H * 0.12, lily, lilyF);
      stem(ctx, W * 0.5, H * 0.875, W * 0.495, H * 0.77, -W * 0.004, 2);
      bud(ctx, W * 0.495, H * 0.775, H * 0.058, 0.1, lily);
      finish(ctx, W, H, { seed: 65, vignette: 0.3, grain: 0.015 });
    },

    // ── A cart left by the road ─────────────────────────────────────────────────────────────────────────
    cart(ctx, W, H) {
      const R = random(71);
      const hy = H * 0.635;
      const sx = W * 0.44;
      sky(ctx, W, H, {
        ...DUSK, seed: 71, hy, sun: [sx, hy - H * 0.01], spread: [2.2, 10], amount: 0.9, cloudAlpha: 0.62,
        stops: [[0, '#150a06'], [0.4, '#3a1a0a'], [0.7, '#8a4216'], [0.9, '#d07a28'], [1, '#f6a650']],
      });
      sun(ctx, sx, hy - H * 0.022, H * 0.046, '#ffe6b0', '#ff9f4a');
      ridge(ctx, W, hy, H * 0.02, '#7a3c18', 72, 3.2, hy + 2);
      ridge(ctx, W, hy + 1, H * 0.012, '#4a2410', 73, 5, hy + 2);
      const far = layer(W, H);
      for (const [x, h] of [[0.15, 0.11], [0.2, 0.15], [0.24, 0.1], [0.31, 0.12]]) palm(far, R, W * x, hy + 1, H * h, '#4a2210');
      ctx.drawImage(far.canvas, 0, 0);
      birds(ctx, R, W * 0.5, H * 0.31, H * 0.01, 7);
      // Earth, and the pale road coming down from the light towards you.
      const g = ctx.createLinearGradient(0, hy, 0, H);
      g.addColorStop(0, '#54290f');
      g.addColorStop(0.28, '#2c1408');
      g.addColorStop(1, '#0e0604');
      ctx.fillStyle = g;
      ctx.fillRect(0, hy, W, H - hy);
      const road = ctx.createLinearGradient(0, hy, 0, H);
      road.addColorStop(0, '#f6b060');
      road.addColorStop(0.3, '#a8622a');
      road.addColorStop(1, '#2e180c');
      ctx.fillStyle = road;
      ctx.beginPath();
      ctx.moveTo(sx - W * 0.004, hy);
      ctx.bezierCurveTo(W * 0.42, hy + H * 0.1, W * 0.2, H * 0.86, W * 0.06, H);
      ctx.lineTo(W * 0.62, H);
      ctx.bezierCurveTo(W * 0.56, H * 0.86, W * 0.47, hy + H * 0.08, sx + W * 0.004, hy);
      ctx.closePath();
      ctx.fill();
      const N = noise(74);
      const y0 = Math.round(hy);
      const img = ctx.getImageData(0, y0, W, H - y0);
      for (let y = 0; y < img.height; y++) {
        const t = y / img.height;
        for (let x = 0; x < W; x++) {
          const n = N.fbm((x * 0.01) / (0.16 + t), (y * 0.1) / (0.12 + t), 4);
          const i = (y * W + x) * 4;
          const k = 0.7 + n * 0.6;
          img.data[i] *= k;
          img.data[i + 1] *= k;
          img.data[i + 2] *= k;
        }
      }
      ctx.putImageData(img, 0, y0);
      // A low bund on the right: the palms stand on it, and the cart rests on its crest against the sky.
      const near = layer(W, H);
      near.fillStyle = '#0d0604';
      near.beginPath();
      near.moveTo(W * 0.62, H);
      near.bezierCurveTo(W * 0.55, H * 0.92, W * 0.44, hy + H * 0.1, W * 0.56, hy + H * 0.042);
      near.lineTo(W, hy + H * 0.02);
      near.lineTo(W, H);
      near.closePath();
      near.fill();
      for (const [x, h] of [[0.905, 0.46], [0.955, 0.62], [0.985, 0.41]]) palm(near, R, W * x, hy + H * 0.03, H * h, '#0d0604');
      lightFrom(near, W, H, sx, hy, '#a4501c', H * 0.56, 0.16);
      ctx.drawImage(near.canvas, 0, 0);
      const c = layer(W, H);
      cartShape(c, W * 0.765, hy + H * 0.04, H * 0.13);
      lightFrom(c, W, H, sx, hy - H * 0.05, '#c56a26', H * 0.48, 0.26);
      ctx.drawImage(c.canvas, 0, 0);
      // Short tufts along the bund.
      for (let i = 0; i < 260; i++) {
        const t = R();
        const x = W * (0.53 + t * 0.48);
        const y = hy + H * (0.036 + Math.pow(R(), 3) * 0.05);
        const s = 5 + R() * 11;
        ctx.strokeStyle = 'rgba(12,6,3,0.92)';
        ctx.lineWidth = 1;
        for (let b = 0; b < 3; b++) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + (b - 1) * s * 0.1, y - s * 0.6, x + (b - 1) * s * 0.42, y - s);
          ctx.stroke();
        }
      }
      finish(ctx, W, H, { seed: 75, vignette: 0.3, grain: 0.015 });
    },

    // ── A lamp ──────────────────────────────────────────────────────────────────────────────────────────
    lamp(ctx, W, H) {
      const R = random(81);
      const ly = H * 0.76;
      const fx = W * 0.6;
      const fy = H * 0.46;
      wood(ctx, W, H, 82, ['#0f0805', '#1e1108', '#2e1b0d']);
      const wall = ctx.createRadialGradient(fx, H * 0.66, 0, fx, H * 0.66, W * 0.74);
      wall.addColorStop(0, 'rgba(120,62,22,0.92)');
      wall.addColorStop(0.28, 'rgba(62,30,12,0.9)');
      wall.addColorStop(0.68, 'rgba(18,9,4,0.92)');
      wall.addColorStop(1, 'rgba(9,5,3,0.98)');
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, W, ly);
      // The stone ledge, warm near the flame.
      const sill = ctx.createLinearGradient(0, ly, 0, H);
      sill.addColorStop(0, '#5a3214');
      sill.addColorStop(0.45, '#2e1a0c');
      sill.addColorStop(1, '#110a06');
      ctx.fillStyle = sill;
      ctx.fillRect(0, ly, W, H - ly);
      const N = noise(83);
      const img = ctx.getImageData(0, ly, W, H - ly);
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < W; x++) {
          const n = N.fbm(x * 0.03, y * 0.09, 4);
          const i = (y * W + x) * 4;
          const k = 0.76 + n * 0.5;
          img.data[i] *= k;
          img.data[i + 1] *= k;
          img.data[i + 2] *= k;
        }
      }
      ctx.putImageData(img, 0, ly);
      const pool = ctx.createRadialGradient(fx, ly + H * 0.07, 0, fx, ly + H * 0.07, W * 0.46);
      pool.addColorStop(0, 'rgba(255,170,84,0.46)');
      pool.addColorStop(1, 'rgba(255,170,84,0)');
      ctx.save();
      ctx.translate(0, ly + H * 0.07);
      ctx.scale(1, 0.34);
      ctx.translate(0, -(ly + H * 0.07));
      ctx.fillStyle = pool;
      ctx.fillRect(0, ly - H * 0.4, W, H);
      ctx.restore();
      // A tied bundle of leaves, lying behind the lamp.
      ctx.save();
      ctx.translate(W * 0.17, ly + H * 0.052);
      ctx.rotate(-0.016);
      const bl = W * 0.66;
      const leafCount = 13;
      for (let i = 0; i < leafCount; i++) {
        const y = -i * 4.4;
        const g = ctx.createLinearGradient(-bl / 2, 0, bl / 2, 0);
        const lit = 0.72 + R() * 0.28;
        g.addColorStop(0, css(mix(rgb('#1c1008'), rgb('#3a2412'), lit)));
        g.addColorStop(0.5, css(mix(rgb('#46290f'), rgb('#7a5226'), lit)));
        g.addColorStop(0.86, css(mix(rgb('#7a5226'), rgb('#d6ab6e'), lit)));
        g.addColorStop(1, css(mix(rgb('#46290f'), rgb('#8a6030'), lit)));
        ctx.fillStyle = g;
        const off = (R() - 0.5) * 14;
        ctx.beginPath();
        ctx.roundRect(-bl / 2 + off, y - 4, bl, 4.6, 2.2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(16,8,3,0.62)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      const lid = ctx.createLinearGradient(-bl / 2, 0, bl / 2, 0);
      lid.addColorStop(0, '#120a05');
      lid.addColorStop(0.7, '#4a2a12');
      lid.addColorStop(0.92, '#8f5c2c');
      lid.addColorStop(1, '#3a200f');
      ctx.fillStyle = lid;
      ctx.beginPath();
      ctx.roundRect(-bl / 2 - 6, -leafCount * 4.4 - 12, bl + 12, 11, 3);
      ctx.fill();
      for (const x of [-bl * 0.2, bl * 0.14]) {
        const c = ctx.createLinearGradient(x, 0, x + 8, 0);
        c.addColorStop(0, '#3e140c');
        c.addColorStop(0.5, '#8e3220');
        c.addColorStop(1, '#3e140c');
        ctx.fillStyle = c;
        ctx.fillRect(x, -leafCount * 4.4 - 13, 8, leafCount * 4.4 + 16);
      }
      ctx.restore();
      // The lamp: a small clay dish with a pinched lip for the wick.
      const bx = W * 0.6;
      const by = ly + H * 0.09;
      const flameY = by - H * 0.19;
      const bw = W * 0.128;
      const bh = H * 0.082;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 8;
      const clay = ctx.createLinearGradient(bx - bw, 0, bx + bw, 0);
      clay.addColorStop(0, '#26120a');
      clay.addColorStop(0.46, '#7c4522');
      clay.addColorStop(0.66, '#9a5a2e');
      clay.addColorStop(1, '#2e160c');
      ctx.fillStyle = clay;
      ctx.beginPath();
      ctx.moveTo(bx - bw, by - bh * 0.4);
      ctx.bezierCurveTo(bx - bw * 0.9, by + bh * 0.9, bx + bw * 0.9, by + bh * 0.9, bx + bw, by - bh * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      const rim = ctx.createLinearGradient(bx - bw, 0, bx + bw, 0);
      rim.addColorStop(0, '#4a2412');
      rim.addColorStop(0.55, '#dc9458');
      rim.addColorStop(1, '#5e2f16');
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.ellipse(bx, by - bh * 0.4, bw, bh * 0.44, 0, 0, TAU);
      ctx.fill();
      const oil = ctx.createRadialGradient(bx + bw * 0.1, by - bh * 0.42, 2, bx, by - bh * 0.4, bw * 0.92);
      oil.addColorStop(0, '#ffcf80');
      oil.addColorStop(0.3, '#b56b24');
      oil.addColorStop(1, '#2a1208');
      ctx.fillStyle = oil;
      ctx.beginPath();
      ctx.ellipse(bx, by - bh * 0.4, bw * 0.9, bh * 0.34, 0, 0, TAU);
      ctx.fill();
      // Wick and flame, with its light added over everything.
      ctx.strokeStyle = '#120804';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx - bw * 0.3, by - bh * 0.42);
      ctx.quadraticCurveTo(bx - bw * 0.1, by - bh * 0.5, fx, by - bh * 0.92);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      for (const [rad, a] of [[W * 0.55, 0.18], [W * 0.26, 0.3], [W * 0.1, 0.5]]) {
        const g = ctx.createRadialGradient(fx, flameY, 0, fx, flameY, rad);
        g.addColorStop(0, `rgba(255,150,60,${a})`);
        g.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = 'source-over';
      const fh = H * 0.21;
      const fw = W * 0.046;
      const baseY = by - bh * 0.92;
      const flame = (h, w, top, mid, bottom, sway) => {
        const g = ctx.createLinearGradient(0, baseY, 0, baseY - h);
        g.addColorStop(0, bottom);
        g.addColorStop(0.28, mid);
        g.addColorStop(1, top);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(fx, baseY + 3);
        ctx.bezierCurveTo(fx - w * 1.5, baseY - h * 0.16, fx - w * 0.72, baseY - h * 0.62, fx + sway, baseY - h);
        ctx.bezierCurveTo(fx + w * 0.72, baseY - h * 0.62, fx + w * 1.5, baseY - h * 0.16, fx, baseY + 3);
        ctx.fill();
      };
      ctx.filter = 'blur(5px)';
      flame(fh * 1.1, fw * 1.24, 'rgba(255,120,40,0)', 'rgba(255,130,40,0.84)', 'rgba(120,70,120,0.38)', 3);
      ctx.filter = 'blur(1.5px)';
      flame(fh, fw, 'rgba(255,186,70,0.92)', 'rgba(255,190,80,1)', 'rgba(140,110,170,0.6)', 2);
      ctx.filter = 'blur(2px)';
      flame(fh * 0.68, fw * 0.62, 'rgba(255,244,190,0.95)', 'rgba(255,250,214,1)', 'rgba(255,214,130,0.4)', 1);
      ctx.filter = 'none';
      finish(ctx, W, H, { seed: 84, vignette: 0.4, grain: 0.016, wash: 0.06 });
    },

    // ── Closing: the light nearly gone ──────────────────────────────────────────────────────────────────
    dusk(ctx, W, H) {
      const R = random(91);
      const hy = H * 0.8;
      const sx = W * 0.8;
      sky(ctx, W, H, {
        ...DUSK, seed: 91, hy, sun: [sx, hy + H * 0.05], spread: [1.3, 7], amount: 0.8, coreAmount: 0.46, cloudAlpha: 0.74,
        stops: [[0, '#120806'], [0.42, '#2d130a'], [0.72, '#6a2e12'], [0.92, '#b65a1e'], [1, '#e88a38']],
        cloudDark: '#1f0e08', cloudLit: '#d8824a',
      });
      ridge(ctx, W, hy + 1, H * 0.025, '#3f1d0d', 92, 3, hy + 2);
      const far = layer(W, H);
      for (const [x, h] of [[0.52, 0.17], [0.56, 0.23], [0.6, 0.15], [0.66, 0.2], [0.71, 0.14]]) palm(far, R, W * x, hy + 1, H * h, '#361a0c');
      ctx.drawImage(far.canvas, 0, 0);
      const near = layer(W, H);
      palmsOver(near, R, W, H, [[0.79, 0.84, 0.52], [0.84, 0.86, 0.68], [0.9, 0.85, 0.46], [0.96, 0.87, 0.6]]);
      ctx.drawImage(near.canvas, 0, 0);
      const g = ctx.createLinearGradient(0, hy, 0, H);
      g.addColorStop(0, '#1a0c06');
      g.addColorStop(1, '#080402');
      ctx.fillStyle = g;
      ctx.fillRect(0, hy + 1, W, H - hy);
      birds(ctx, R, W * 0.54, H * 0.42, H * 0.012, 8);
      finish(ctx, W, H, { seed: 94, vignette: 0.24, grain: 0.015 });
    },

    // ── The picture link previews show: the name, plainly, on the closing dusk ──────────────────────────
    og(ctx, W, H) {
      SCENES.dusk(ctx, W, H);
      const shade = ctx.createLinearGradient(0, 0, W, 0);
      shade.addColorStop(0, 'rgba(11,6,3,0.86)');
      shade.addColorStop(0.55, 'rgba(11,6,3,0.5)');
      shade.addColorStop(0.8, 'rgba(11,6,3,0)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ebb468';
      ctx.font = '400 34px "Noto Serif Tamil"';
      ctx.fillText('திருக்குறள்', 76, 212);
      ctx.fillStyle = '#f5efe6';
      ctx.font = '500 96px "Source Serif 4"';
      ctx.fillText('Kural Graph', 72, 320);
      ctx.fillStyle = '#ddd3c5';
      ctx.font = '400 32px "Inter"';
      ctx.fillText('All 1,330 couplets of the Tirukkural', 76, 386);
      ctx.fillText('and how their ideas connect', 76, 432);
    },
  });

  /** Palms standing on the near ground: [x, base y, height], each as a fraction of the picture. */
  function palmsOver(ctx, R, W, H, list) {
    for (const [x, y, h] of list) palm(ctx, R, W * x, H * y, H * h, '#0f0705');
    ctx.fillStyle = '#0f0705';
    const y0 = Math.min(...list.map((p) => p[1]));
    ctx.beginPath();
    ctx.moveTo(W * (list[0][0] - 0.12), H);
    ctx.quadraticCurveTo(W * (list[0][0] - 0.05), H * y0, W * list[0][0], H * y0);
    ctx.lineTo(W, H * (y0 - 0.01));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  /** A bullock cart with its hood up, unyoked, its pole resting on the ground. */
  function cartShape(ctx, x, gy, R) {
    const col = '#0c0604';
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cy = gy - R;
    const line = (a, b, c, d, w) => {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(c, d);
      ctx.stroke();
    };
    // The far wheel shows behind the near one.
    wheel(ctx, x + R * 0.22, cy - R * 0.03, R * 0.96, col, 0.55);
    // Bed, side rail and the long pole down to the ground, with the yoke across its end.
    const bedY = cy - R * 0.34;
    const back = x + R * 1.5;
    const front = x - R * 1.35;
    line(back, bedY, front, bedY, R * 0.09);
    line(back - R * 0.06, bedY - R * 0.2, front + R * 0.16, bedY - R * 0.2, R * 0.045);
    for (let i = 0; i < 9; i++) {
      const px = lerp(front + R * 0.22, back - R * 0.1, i / 8);
      line(px, bedY - R * 0.2, px, bedY, R * 0.03);
    }
    line(front, bedY, x - R * 3.5, gy + R * 0.02, R * 0.085);
    line(x - R * 3.42, gy - R * 0.32, x - R * 3.56, gy + R * 0.04, R * 0.07);
    // The hood: hooped and matted, open at both ends so the sky shows through its ribs at the rim.
    const hx0 = x - R * 0.98;
    const hx1 = x + R * 1.3;
    const top = bedY - R * 1.05;
    ctx.beginPath();
    ctx.moveTo(hx0, bedY - R * 0.2);
    ctx.bezierCurveTo(hx0 - R * 0.06, top + R * 0.16, hx0 + R * 0.36, top, x + R * 0.16, top);
    ctx.bezierCurveTo(hx1 - R * 0.36, top, hx1 + R * 0.06, top + R * 0.16, hx1, bedY - R * 0.2);
    ctx.closePath();
    ctx.fill();
    // The hoops under the matting catch a little of the light.
    for (let i = 1; i <= 5; i++) {
      const px = lerp(hx0, hx1, i / 6);
      const bow = Math.sin((i / 6) * Math.PI);
      ctx.strokeStyle = 'rgba(190,112,50,0.3)';
      ctx.lineWidth = R * 0.016;
      ctx.beginPath();
      ctx.moveTo(px, bedY - R * 0.22);
      ctx.quadraticCurveTo(px + (px - x) * 0.04, lerp(bedY, top, 0.6), px - (px - x - R * 0.16) * 0.08, top + R * 0.03 + (1 - bow) * R * 0.1);
      ctx.stroke();
    }
    wheel(ctx, x, cy, R, col, 1);
  }

  function wheel(ctx, x, y, R, col, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = R * 0.11;
    ctx.beginPath();
    ctx.arc(x, y, R * 0.94, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = R * 0.038;
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * TAU + 0.13;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(t) * R * 0.15, y + Math.sin(t) * R * 0.15);
      ctx.lineTo(x + Math.cos(t) * R * 0.9, y + Math.sin(t) * R * 0.9);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, R * 0.17, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function night(ctx, W, H, data, o) {
    const R = random(o.seed);
    const N = noise(o.seed + 1);
    const hy = H * o.horizon;
    // The sky: near-black, a last ember along the ground, a faint band of far stars.
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const stops = [[0, '#060509'], [0.5, '#0c0912'], [0.72, '#1d1118'], [0.88, '#5a2618'], [1, '#d0702a']];
    for (let y = 0; y < H; y++) {
      const v = clamp(y / hy);
      const base = ramp(stops, v);
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const band = Math.exp(-Math.pow((v - 0.2 - u * 0.36) / 0.3, 2));
        const dust = smooth(0.4, 0.74, N.fbm(u * 3.2 * (W / H) * 0.5, v * 3, 6)) * band;
        const col = screen(base, mix([0, 0, 0], [0.34, 0.2, 0.2], dust * 0.7));
        const i = (y * W + x) * 4;
        d[i] = col[0] * 255;
        d[i + 1] = col[1] * 255;
        d[i + 2] = col[2] * 255;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(255,${235 + R() * 20},${215 + R() * 40},${0.1 + R() * R() * 0.6})`;
      ctx.beginPath();
      ctx.arc(R() * W, R() * hy, 0.25 + R() * 0.55, 0, TAU);
      ctx.fill();
    }
    // The graph, as the home page's preview shows it, tilted and fitted to the sky.
    const TILT = 0.5;
    const ANGLE = 0.6;
    const pts = new Map();
    let mx = 1;
    let my = 1;
    for (const n of data.nodes) {
      const p = data.positions[n.id];
      if (!p) continue;
      const x1 = p[0] * Math.cos(ANGLE) - p[2] * Math.sin(ANGLE);
      const z1 = p[0] * Math.sin(ANGLE) + p[2] * Math.cos(ANGLE);
      const y1 = p[1] * Math.cos(TILT) - z1 * Math.sin(TILT);
      pts.set(n.id, { x: x1, y: y1, type: n.type });
      mx = Math.max(mx, Math.abs(x1));
      my = Math.max(my, Math.abs(y1));
    }
    const fx = (W * o.fitX) / mx;
    const fy = (H * o.fitY) / my;
    for (const p of pts.values()) {
      p.x = W * o.cx + p.x * fx;
      p.y = H * o.cy - p.y * fy;
    }
    ctx.lineWidth = 0.55;
    ctx.strokeStyle = 'rgba(255,218,170,0.075)';
    ctx.beginPath();
    for (const [a, b] of data.edges) {
      const p = pts.get(a);
      const q = pts.get(b);
      if (!p || !q) continue;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    const tone = { Chapter: '#ffcf88', Verse: '#f4e9dc', SanskritConcept: '#9fc4ff', Emotion: '#ffb68c', LifeDilemma: '#c4b8ff', Character: '#fff4e4' };
    const size = { Chapter: 1.5, Verse: 0.8, SanskritConcept: 1.45, Emotion: 1.45, LifeDilemma: 1.5, Character: 1.8 };
    for (const p of pts.values()) {
      const r = size[p.type] * (0.8 + R() * 0.4);
      const c = tone[p.type] ?? '#ffffff';
      if (p.type !== 'Verse') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4.4);
        g.addColorStop(0, css(rgb(c), 0.24));
        g.addColorStop(1, css(rgb(c), 0));
        ctx.fillStyle = g;
        ctx.fillRect(p.x - r * 4.4, p.y - r * 4.4, r * 8.8, r * 8.8);
      }
      ctx.fillStyle = css(rgb(c), p.type === 'Verse' ? 0.78 : 0.96);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    }
    // Black ground and palms against the last of the light.
    ridge(ctx, W, hy, H * 0.03, '#090506', o.seed + 2, 7, H);
    const t = layer(W, H);
    for (const [x, h] of o.palms) palm(t, R, W * x, hy + 2, H * h, '#080405');
    ctx.drawImage(t.canvas, 0, 0);
    finish(ctx, W, H, { seed: o.seed + 3, vignette: 0.26, grain: 0.012, wash: 0.04 });
  }

  window.SCENES = SCENES;
})();
