import { ANALYZER_COLORS, CHANNEL_COLORS } from '../lib/palette';
import { BITS_PER_BYTE, bitLevel, byteLabel, toBytes } from '../lib/uart';

const FONT = '"Inter Variable", Inter, system-ui, sans-serif';
const BIT_PX = 1.4;
const BYTE_PX = 22;
const LEAD = 3;
const TRAIL = 3;

const COLOR = {
  background: '#ffffff',
  ruler: '#ffffff',
  rulerText: '#667085',
  tick: '#d1d5db',
  grid: '#eef0f3',
  separator: '#e5e7eb',
  label: '#98a2b3',
  bubbleText: '#141415',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface Row {
  text: string;
  bytes: number[];
  color: string;
  t0: number;
  t1: number;
}

/**
 * A compact, interactive UART capture for project covers that don't have a photo.
 * Pinch to zoom; two-finger horizontal scroll or drag to pan. Vertical scroll stays with the page.
 */
export function mountMiniCapture(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  const ctx = canvas?.getContext('2d');
  const texts = JSON.parse(root.dataset.texts ?? '[]') as string[];
  if (!canvas || !ctx || texts.length === 0) return;

  const rows: Row[] = texts.slice(0, 4).map((text, i) => {
    const bytes = toBytes(text);
    const t0 = LEAD;
    const t1 = t0 + bytes.length * BITS_PER_BYTE;
    return { text, bytes, color: CHANNEL_COLORS[i % CHANNEL_COLORS.length], t0, t1 };
  });

  const spanMax = Math.max(...rows.map((row) => row.t1)) + TRAIL;
  const spanMin = 8;
  const spanCap = spanMax * 1.4;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let a = 0;
  let b = spanMax;
  let raf = 0;
  let drag: { x: number; y: number; a0: number; b0: number; moved: boolean } | null = null;
  let pinch: { startDist: number; mid: number; startA: number; startB: number } | null = null;
  let blockedClick = false;
  const pointers = new Map<number, { x: number; y: number }>();

  const x = (t: number) => ((t - a) * W) / (b - a);

  function fitWindow(): [number, number] {
    return [-1.5, spanMax + 1.5];
  }

  function homeWindow(): [number, number] {
    // Fit so the longest tag's full UART frame is visible edge-to-edge on load.
    const end = Math.max(...rows.map((row) => row.t1));
    return [-1.2, end + 1.5];
  }

  /** Fit one channel's UART payload across the canvas width. */
  function fitRow(index: number) {
    const row = rows[index];
    if (!row) return;
    applyWindow(row.t0 - 1.2, row.t1 + 1.5);
  }

  function applyWindow(from: number, to: number) {
    const span = clamp(to - from, spanMin, spanCap);
    const center = (from + to) / 2;
    a = center - span / 2;
    b = center + span / 2;
    requestDraw();
  }

  /** Zoom keeping the time under `px` fixed. `factor` > 1 zooms in. */
  function zoomAt(factor: number, px: number) {
    const span = b - a;
    const anchor = a + (px / Math.max(W, 1)) * span;
    const next = clamp(span / factor, spanMin, spanCap);
    applyWindow(anchor - (px / Math.max(W, 1)) * next, anchor - (px / Math.max(W, 1)) * next + next);
  }

  function panBy(px: number) {
    const shift = (px * (b - a)) / Math.max(W, 1);
    a += shift;
    b += shift;
    requestDraw();
  }

  function roundRect(left: number, top: number, width: number, height: number, radius: number) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx!.beginPath();
    ctx!.moveTo(left + r, top);
    ctx!.arcTo(left + width, top, left + width, top + height, r);
    ctx!.arcTo(left + width, top + height, left, top + height, r);
    ctx!.arcTo(left, top + height, left, top, r);
    ctx!.arcTo(left, top, left + width, top, r);
    ctx!.closePath();
    ctx!.fill();
  }

  function drawBubble(x0: number, x1: number, top: number, height: number, fill: string, text: string) {
    if (x1 < 0 || x0 > W) return;
    const left = Math.max(x0, -2);
    const right = Math.min(x1, W + 2) - 1;
    const width = right - left;
    if (width < 1) return;
    ctx!.fillStyle = fill;
    if (width > 4) roundRect(left, top, width, height, 2);
    else ctx!.fillRect(left, top, width, height);
    if (width < 12) return;
    ctx!.fillStyle = COLOR.bubbleText;
    ctx!.font = `500 ${height < 15 ? 10 : 11}px ${FONT}`;
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    const label = textWidthFit(text, width - 6);
    if (label) ctx!.fillText(label, (left + right) / 2, top + height / 2 + 0.5);
  }

  function textWidthFit(text: string, max: number): string {
    if (ctx!.measureText(text).width <= max) return text;
    let lo = 0;
    let hi = text.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ctx!.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= max) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? `${text.slice(0, lo).trimEnd()}…` : '';
  }

  function draw() {
    raf = 0;
    const rulerH = Math.max(22, Math.round(H * 0.09));
    const rowH = (H - rulerH) / rows.length;
    const pxPerBit = W / (b - a);

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.fillStyle = COLOR.background;
    ctx!.fillRect(0, 0, W, H);

    // Ruler
    ctx!.fillStyle = COLOR.ruler;
    ctx!.fillRect(0, 0, W, rulerH);
    ctx!.fillStyle = COLOR.separator;
    ctx!.fillRect(0, rulerH - 1, W, 1);

    const bitUs = 1e6 / 115_200;
    const stepBits = [5, 10, 20, 50, 100, 200, 500, 1000].find((n) => n * pxPerBit >= 70) ?? 2000;
    ctx!.font = `500 11px ${FONT}`;
    ctx!.textBaseline = 'middle';
    ctx!.textAlign = 'left';
    for (let t = Math.floor(a / stepBits) * stepBits; t < b + stepBits; t += stepBits) {
      const at = Math.round(x(t));
      ctx!.fillStyle = COLOR.tick;
      ctx!.fillRect(at, rulerH - 9, 1, 8);
      ctx!.fillStyle = COLOR.grid;
      ctx!.fillRect(at, rulerH, 1, H - rulerH);
      const us = t * bitUs;
      const label = us >= 1000 ? `+${(us / 1000).toFixed(us >= 10000 ? 0 : 1)} ms` : `+${Math.round(us)} µs`;
      ctx!.fillStyle = COLOR.rulerText;
      ctx!.fillText(label, at + 5, rulerH / 2 - 1);
    }

    rows.forEach((row, i) => {
      const top = rulerH + i * rowH;
      if (i > 0) {
        ctx!.fillStyle = COLOR.separator;
        ctx!.fillRect(0, top, W, 1);
      }

      const high = Math.round(top + rowH * 0.5) + 0.5;
      const low = Math.round(top + rowH * 0.84) + 0.5;
      const bubbleY = top + rowH * 0.14;
      const bubbleH = Math.max(12, Math.min(18, rowH * 0.28));

      ctx!.fillStyle = COLOR.label;
      ctx!.font = `500 12px ${FONT}`;
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(`D${i}`, 10, (high + low) / 2);

      const bitwise = pxPerBit >= BIT_PX;
      const y = (level: 0 | 1) => (level ? high : low);
      const levelAt = (t: number): 0 | 1 => {
        if (t < row.t0 || t >= row.t1) return 1;
        const index = Math.min(row.bytes.length - 1, Math.floor((t - row.t0) / BITS_PER_BYTE));
        const bit = Math.floor(t - row.t0 - index * BITS_PER_BYTE);
        return bitLevel(row.bytes[index], bit);
      };

      let level = levelAt(a);
      const path = new Path2D();
      path.moveTo(0, y(level));

      if (bitwise) {
        for (let bi = 0; bi < row.bytes.length; bi++) {
          const start = row.t0 + bi * BITS_PER_BYTE;
          if (start + BITS_PER_BYTE < a) continue;
          if (start > b) break;
          for (let k = 0; k < BITS_PER_BYTE; k++) {
            const edgeT = start + k;
            if (edgeT < a || edgeT > b) continue;
            const next = bitLevel(row.bytes[bi], k);
            if (next === level) continue;
            const edge = Math.round(x(edgeT)) + 0.5;
            path.lineTo(edge, y(level));
            level = next;
            path.lineTo(edge, y(level));
          }
        }
        if (row.t1 >= a && row.t1 <= b && level !== 1) {
          const edge = Math.round(x(row.t1)) + 0.5;
          path.lineTo(edge, y(level));
          level = 1;
          path.lineTo(edge, y(level));
        }
      } else if (row.t1 >= a && row.t0 <= b) {
        const x0 = Math.max(0, x(row.t0));
        const x1 = Math.min(W, x(row.t1));
        path.lineTo(x0, high);
        path.lineTo(x0, low);
        path.lineTo(x1, low);
        path.lineTo(x1, high);
        level = 1;
      }
      path.lineTo(W, y(level));
      ctx!.strokeStyle = row.color;
      ctx!.lineWidth = 1.5;
      ctx!.stroke(path);

      if (!bitwise) {
        ctx!.fillStyle = row.color;
        ctx!.globalAlpha = 0.75;
        ctx!.fillRect(Math.floor(x(row.t0)), high, Math.max(1, Math.ceil(x(row.t1) - x(row.t0))), low - high);
        ctx!.globalAlpha = 1;
        drawBubble(x(row.t0), x(row.t1), bubbleY, bubbleH, ANALYZER_COLORS.project, row.text);
        return;
      }

      if (pxPerBit * BITS_PER_BYTE >= BYTE_PX) {
        row.bytes.forEach((byte, bi) => {
          const start = row.t0 + bi * BITS_PER_BYTE;
          drawBubble(x(start), x(start + BITS_PER_BYTE), bubbleY, bubbleH, ANALYZER_COLORS.project, byteLabel(byte));
        });
      } else {
        drawBubble(x(row.t0), x(row.t1), bubbleY, bubbleH, ANALYZER_COLORS.project, row.text);
      }
    });
  }

  function requestDraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  let booted = false;

  function resize() {
    const rect = root.getBoundingClientRect();
    const nextW = Math.max(1, Math.floor(rect.width));
    const nextH = Math.max(1, Math.floor(rect.height));
    if (nextW === W && nextH === H && booted) return;
    W = nextW;
    H = nextH;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    if (!booted) {
      [a, b] = homeWindow();
      booted = true;
    }
    requestDraw();
  }

  const localX = (clientX: number) => {
    const rect = canvas.getBoundingClientRect();
    return clientX - rect.left;
  };

  // Pinch = ctrl+wheel. Two-finger left/right = deltaX pan. Vertical wheel stays with the page.
  root.addEventListener(
    'wheel',
    (event) => {
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? W : 1;
      const dx = event.deltaX * scale;
      const dy = event.deltaY * scale;

      if (event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        blockedClick = true;
        zoomAt(Math.exp(-clamp(dy, -40, 40) * 0.012), localX(event.clientX));
        return;
      }

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 0.5) {
        event.preventDefault();
        event.stopPropagation();
        blockedClick = true;
        panBy(dx);
      }
    },
    { passive: false },
  );

  root.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    root.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      drag = { x: event.clientX, y: event.clientY, a0: a, b0: b, moved: false };
      pinch = null;
    } else if (pointers.size === 2) {
      const [p, q] = [...pointers.values()];
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      pinch = { startDist: Math.max(dist, 1), mid: localX((p.x + q.x) / 2), startA: a, startB: b };
      drag = null;
    }
  });

  root.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinch && pointers.size >= 2) {
      const [p, q] = [...pointers.values()];
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      if (dist <= 0) return;
      blockedClick = true;
      const startSpan = pinch.startB - pinch.startA;
      const next = clamp(startSpan * (pinch.startDist / dist), spanMin, spanCap);
      const anchor = pinch.startA + (pinch.mid / Math.max(W, 1)) * startSpan;
      applyWindow(anchor - (pinch.mid / Math.max(W, 1)) * next, anchor - (pinch.mid / Math.max(W, 1)) * next + next);
      return;
    }

    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    blockedClick = true;
    const shift = (-dx * (drag.b0 - drag.a0)) / Math.max(W, 1);
    a = drag.a0 + shift;
    b = drag.b0 + shift;
    requestDraw();
  });

  const endPointer = (event: PointerEvent) => {
    const ended = drag;
    pointers.delete(event.pointerId);
    try {
      root.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) {
      const remaining = [...pointers.entries()][0];
      drag = { x: remaining[1].x, y: remaining[1].y, a0: a, b0: b, moved: false };
    }
    if (pointers.size === 0) {
      // Tap a channel row → fit that tag's UART across the width.
      if (ended && !ended.moved && event.type === 'pointerup') {
        const rect = canvas.getBoundingClientRect();
        const rulerH = Math.max(22, Math.round(H * 0.09));
        const row = Math.floor((ended.y - rect.top - rulerH) / ((H - rulerH) / rows.length));
        if (row >= 0 && row < rows.length) {
          fitRow(row);
          blockedClick = true;
        }
      }
      drag = null;
    }
  };
  root.addEventListener('pointerup', endPointer);
  root.addEventListener('pointercancel', endPointer);

  // Inside project cards the cover sits in a link — block navigation after a pan/pinch/fit.
  root.addEventListener(
    'click',
    (event) => {
      if (!blockedClick) return;
      event.preventDefault();
      event.stopPropagation();
      blockedClick = false;
    },
    true,
  );

  root.addEventListener('keydown', (event) => {
    if (event.key === '0') {
      event.preventDefault();
      applyWindow(...fitWindow());
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      panBy(-W * 0.2);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      panBy(W * 0.2);
    }
  });

  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();
}
