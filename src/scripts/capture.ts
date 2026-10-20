import type { ChannelSignal } from '../lib/capture-data';
import { formatDuration, formatScale } from '../lib/dates';
import { BITS_PER_BYTE, bitLevel, byteHex, byteLabel, toBytes } from '../lib/uart';

const DAY_MS = 86_400_000;
const LEAD_BITS = 4;
const GAP_BITS = 8;
const TRAIL_BITS = 4;
/** Narrowest window, in days, at full zoom. */
const MIN_SPAN = 1.5;
/** Below this many pixels per bit, a channel's data is drawn as a solid block. */
const BIT_PX = 1.5;
/** Decode down to single characters once each byte is this wide. */
const BYTE_BUBBLE_PX = 24;
/** Decode individual frames once the average frame is this wide. */
const FRAME_BUBBLE_PX = 44;
const SWEEP_MS = 1400;
const FONT = '"Inter Variable", Inter, system-ui, sans-serif';

const COLOR = {
  background: '#ffffff',
  noData: '#ffffff',
  ruler: '#ffffff',
  rulerText: '#667085',
  rulerStrong: '#141415',
  tick: '#d1d5db',
  grid: '#eef0f3',
  separator: '#e5e7eb',
  level: '#98a2b3',
  hoverRow: '#f8fafc',
  selectedRow: '#eef7fb',
  frameHighlight: 'rgb(27 125 179 / 0.08)',
  now: '#df7537',
  rise: '#258c48',
  fall: '#df7537',
  bubbleText: '#141415',
  badge: 'rgb(20 20 21 / 0.55)',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Frame {
  text: string;
  t0: number;
  t1: number;
  bytes: number[];
}

/** A channel laid out in time. All times are days since the Unix epoch. */
interface Channel extends ChannelSignal {
  t0: number;
  t1: number;
  ongoing: boolean;
  /** Duration of one bit. Each channel's "baud rate" stretches its payload across its span. */
  bit: number;
  layout: Frame[];
  avgFrame: number;
  edges: number[];
}

type Lod = 'merged' | 'frames' | 'bytes';

interface Step {
  unit: 'h' | 'd' | 'mo';
  n: number;
}

interface Tick {
  t: number;
  label: string;
  strong: boolean;
}

interface Row {
  top: number;
  bubbleY: number;
  bubbleH: number;
  high: number;
  low: number;
}

const STEPS: Step[] = [
  { unit: 'h', n: 1 },
  { unit: 'h', n: 3 },
  { unit: 'h', n: 6 },
  { unit: 'h', n: 12 },
  { unit: 'd', n: 1 },
  { unit: 'd', n: 2 },
  { unit: 'd', n: 7 },
  { unit: 'd', n: 14 },
  { unit: 'mo', n: 1 },
  { unit: 'mo', n: 3 },
  { unit: 'mo', n: 6 },
  { unit: 'mo', n: 12 },
  { unit: 'mo', n: 24 },
];

const stepDays = (step: Step) => (step.unit === 'h' ? step.n / 24 : step.unit === 'd' ? step.n : step.n * 30.44);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function monthStart(value: string): number {
  const [year, month] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, 1) / DAY_MS;
}

function monthAfter(value: string): number {
  const [year, month] = value.split('-').map(Number);
  return Date.UTC(year, month, 1) / DAY_MS;
}

function layoutChannel(signal: ChannelSignal, now: number): Channel {
  const t0 = monthStart(signal.start);
  const end = signal.end ? monthAfter(signal.end) : Infinity;
  const ongoing = end > now;
  const t1 = Math.max(t0 + 1, Math.min(end, now));
  const payload = signal.frames.map(toBytes);
  const dataBits = payload.reduce((sum, bytes) => sum + bytes.length * BITS_PER_BYTE, 0);
  const totalBits = LEAD_BITS + dataBits + GAP_BITS * Math.max(0, payload.length - 1) + TRAIL_BITS;
  const bit = (t1 - t0) / totalBits;

  let t = t0 + LEAD_BITS * bit;
  const layout = payload.map((bytes, i) => {
    const frame = { text: signal.frames[i], t0: t, t1: t + bytes.length * BITS_PER_BYTE * bit, bytes };
    t = frame.t1 + GAP_BITS * bit;
    return frame;
  });

  return {
    ...signal,
    t0,
    t1,
    ongoing,
    bit,
    layout,
    avgFrame: layout.length ? (dataBits * bit) / layout.length : 0,
    edges: [t0, ...layout.flatMap((frame) => [frame.t0, frame.t1]), ...(ongoing ? [] : [t1])],
  };
}

/** Line level at time `t`, bit by bit. */
function levelAt(ch: Channel, t: number): 0 | 1 {
  if (t < ch.t0 || (!ch.ongoing && t >= ch.t1)) return 0;
  const byteTime = ch.bit * BITS_PER_BYTE;
  for (const frame of ch.layout) {
    if (t < frame.t0) return 1;
    if (t < frame.t1) {
      const index = Math.min(Math.floor((t - frame.t0) / byteTime), frame.bytes.length - 1);
      const bitIndex = Math.floor((t - frame.t0 - index * byteTime) / ch.bit);
      return bitLevel(frame.bytes[index], bitIndex);
    }
  }
  return 1;
}

/** Line level at time `t` when the data is too dense to draw bit by bit. */
function spanLevelAt(ch: Channel, t: number): 0 | 1 {
  return t < ch.t0 || (!ch.ongoing && t >= ch.t1) ? 0 : 1;
}

function nests(minor: Step, major: Step): boolean {
  if (minor.unit === major.unit) return major.n % minor.n === 0;
  return major.unit === 'd' && minor.unit === 'h' && 24 % minor.n === 0;
}

function tickTimes(step: Step, from: number, to: number): number[] {
  const times: number[] = [];
  if (step.unit === 'mo') {
    const start = new Date(from * DAY_MS);
    let month = Math.floor((start.getUTCFullYear() * 12 + start.getUTCMonth()) / step.n) * step.n;
    for (let guard = 0; guard < 400; guard++, month += step.n) {
      const t = Date.UTC(Math.floor(month / 12), month % 12, 1) / DAY_MS;
      if (t > to) break;
      times.push(t);
    }
    return times;
  }
  const size = stepDays(step);
  // Weekly ticks land on Mondays; 1970-01-05 was one.
  const offset = step.unit === 'd' && step.n >= 7 ? 4 : 0;
  const first = Math.floor((from - offset) / size) * size + offset;
  for (let i = 0; i < 2000; i++) {
    const t = first + i * size;
    if (t > to) break;
    times.push(t);
  }
  return times;
}

function tickLabel(t: number, step: Step, first: boolean): Omit<Tick, 't'> {
  const date = new Date(Math.round(t * DAY_MS));
  const year = date.getUTCFullYear();
  const month = MONTHS[date.getUTCMonth()];
  const day = date.getUTCDate();
  const hour = date.getUTCHours();

  if (step.unit === 'mo') {
    if (date.getUTCMonth() === 0) return { label: String(year), strong: true };
    return { label: first ? `${month} ${year}` : month, strong: false };
  }
  if (step.unit === 'h' && hour !== 0) return { label: `${String(hour).padStart(2, '0')}:00`, strong: false };
  return { label: first ? `${month} ${day}, ${year}` : `${month} ${day}`, strong: step.unit === 'h' || day === 1 };
}

export function mountCapture(root: HTMLElement): void {
  const wave = root.querySelector<HTMLElement>('[data-wave]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]');
  const ctx = canvas?.getContext('2d');
  const signals = JSON.parse(root.dataset.channels ?? '[]') as ChannelSignal[];
  if (!wave || !canvas || !ctx || signals.length === 0) return;

  const tip = root.querySelector<HTMLElement>('[data-tip]');
  const tipTitle = root.querySelector<HTMLElement>('[data-tip-title]');
  const tipRows = root.querySelector<HTMLElement>('[data-tip-rows]');
  const hint = root.querySelector<HTMLElement>('[data-hint]');
  const help = root.querySelector<HTMLElement>('[data-help]');
  const panel = root.querySelector<HTMLElement>('[data-panel]');
  const defaultSection = root.querySelector<HTMLElement>('[data-panel-default]');
  const sections = [...root.querySelectorAll<HTMLElement>('[data-panel-for]')];
  const labels = [...root.querySelectorAll<HTMLButtonElement>('[data-channel]')];
  const startButton = root.querySelector<HTMLButtonElement>('[data-start]');
  const panelButton = root.querySelector<HTMLButtonElement>('[data-toggle-panel]');
  const helpButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-toggle-help]')];
  const scaleButton = root.querySelector<HTMLButtonElement>('[data-scale]');
  const scaleValue = root.querySelector<HTMLElement>('[data-scale-value]');
  const scaleMenu = root.querySelector<HTMLElement>('[data-scale-menu]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  const now = Date.now() / DAY_MS;
  const channels = signals.map((signal) => layoutChannel(signal, now));
  const indexOf = new Map(channels.map((ch, i) => [ch.id, i]));
  const captureStart = Math.min(...channels.map((ch) => ch.t0));
  const captureEnd = now;
  const maxSpan = (captureEnd - captureStart) * 1.3;

  let W = 0;
  let H = 0;
  let rowH = 56;
  let rulerH = 28;
  let dpr = 1;
  let a = 0;
  let b = 1;
  let raf = 0;
  let hoverRow = -1;
  let hoverX = 0;
  let hoverY = 0;
  let selected = -1;
  let selectedFrame = -1;
  let engaged = false;
  let engageHintShown = false;
  let lastScrollHint = 0;
  let hintTimer = 0;
  let lastScale = '';
  let anim: { a0: number; b0: number; a1: number; b1: number; start: number; duration: number } | null = null;
  let sweep: { start: number } | null = null;
  let drag: { id: number; x: number; sx: number; sy: number; moved: boolean } | null = null;
  let pinch: { dist: number; mid: number } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  const edgeTimes: number[] = [];
  const edgeLevels: (0 | 1)[] = [];

  // Text measurement is the hot path when zooming, so cache it per bubble font.
  let bubbleFont = '';
  const widths = new Map<string, number>();
  const fits = new Map<string, string>();

  function setBubbleFont(size: number) {
    const font = `500 ${size}px ${FONT}`;
    if (font === bubbleFont) return;
    bubbleFont = font;
    widths.clear();
    fits.clear();
  }

  function textWidth(text: string): number {
    let width = widths.get(text);
    if (width === undefined) {
      if (widths.size > 6000) widths.clear();
      width = ctx!.measureText(text).width;
      widths.set(text, width);
    }
    return width;
  }

  function fit(text: string, max: number): string {
    if (max < 7) return '';
    if (textWidth(text) <= max) return text;
    const key = `${text}\u0000${Math.floor(max)}`;
    const cached = fits.get(key);
    if (cached !== undefined) return cached;
    let lo = 0;
    let hi = text.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (textWidth(`${text.slice(0, mid).trimEnd()}…`) <= max) lo = mid;
      else hi = mid - 1;
    }
    const result = lo > 0 ? `${text.slice(0, lo).trimEnd()}…` : '';
    if (fits.size > 4000) fits.clear();
    fits.set(key, result);
    return result;
  }

  const x = (t: number) => ((t - a) * W) / (b - a);
  const time = (px: number) => a + (px * (b - a)) / W;

  function rowAt(top: number): Row {
    const compact = rowH < 52;
    return {
      top,
      bubbleY: top + (compact ? 5 : 7),
      bubbleH: compact ? 14 : 16,
      high: Math.round(top + rowH * 0.5) + 0.5,
      low: Math.round(top + rowH - (compact ? 7 : 9)) + 0.5,
    };
  }

  function lodOf(ch: Channel, pxPerDay: number): Lod {
    if (ch.bit * BITS_PER_BYTE * pxPerDay >= BYTE_BUBBLE_PX) return 'bytes';
    if (ch.avgFrame * pxPerDay >= FRAME_BUBBLE_PX) return 'frames';
    return 'merged';
  }

  function roundRect(left: number, top: number, width: number, height: number, radius: number) {
    ctx!.beginPath();
    if (typeof ctx!.roundRect === 'function') ctx!.roundRect(left, top, width, height, radius);
    else ctx!.rect(left, top, width, height);
    ctx!.fill();
  }

  function requestDraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  // ---- Drawing ----------------------------------------------------------------------------

  function ticksFor(pxPerDay: number): { major: Tick[]; minor: number[] } {
    let majorIndex = STEPS.findIndex((step) => stepDays(step) * pxPerDay >= 84);
    if (majorIndex < 0) majorIndex = STEPS.length - 1;
    const major = STEPS[majorIndex];
    let minor: Step | null = null;
    for (let i = majorIndex - 1; i >= 0; i--) {
      if (stepDays(STEPS[i]) * pxPerDay < 9) break;
      if (nests(STEPS[i], major)) {
        minor = STEPS[i];
        break;
      }
    }
    let firstSeen = false;
    const majorTicks = tickTimes(major, a - stepDays(major), b).map((t) => {
      const first = !firstSeen && x(t) >= -4;
      if (first) firstSeen = true;
      return { t, ...tickLabel(t, major, first) };
    });
    return { major: majorTicks, minor: minor ? tickTimes(minor, a, b) : [] };
  }

  function collectEdges(ch: Channel, from: number, to: number, bitwise: boolean) {
    edgeTimes.length = 0;
    edgeLevels.length = 0;
    const push = (t: number, level: 0 | 1) => {
      if (t > from && t <= to) {
        edgeTimes.push(t);
        edgeLevels.push(level);
      }
    };
    push(ch.t0, 1);
    if (bitwise) {
      const byteTime = ch.bit * BITS_PER_BYTE;
      for (const frame of ch.layout) {
        if (frame.t1 <= from) continue;
        if (frame.t0 > to) break;
        const first = Math.max(0, Math.floor((from - frame.t0) / byteTime));
        const last = Math.min(frame.bytes.length - 1, Math.floor((to - frame.t0) / byteTime));
        for (let i = first; i <= last; i++) {
          const start = frame.t0 + i * byteTime;
          let level: 0 | 1 = 1;
          for (let k = 0; k < BITS_PER_BYTE; k++) {
            const next = bitLevel(frame.bytes[i], k);
            if (next !== level) {
              push(start + k * ch.bit, next);
              level = next;
            }
          }
        }
      }
    }
    if (!ch.ongoing) push(ch.t1, 0);
  }

  function bubble(x0: number, x1: number, row: Row, fill: string, text: string, badge?: string) {
    if (x1 < 0 || x0 > W) return;
    const left = Math.max(x0, -3);
    const right = Math.min(x1, W + 3) - 1;
    const width = right - left;
    if (width < 1) return;
    const { bubbleY: top, bubbleH: height } = row;
    const middle = top + height / 2 + 0.5;

    ctx!.fillStyle = fill;
    if (width > 4) roundRect(left, top, width, height, 2);
    else ctx!.fillRect(left, top, width, height);

    let textLeft = left + 5;
    if (badge) {
      const badgeW = Math.ceil(textWidth(badge)) + 8;
      if (width < badgeW + 4) return;
      ctx!.fillStyle = COLOR.badge;
      roundRect(left + 2, top + 2, badgeW, height - 4, 1.5);
      ctx!.fillStyle = COLOR.bubbleText;
      ctx!.textAlign = 'center';
      ctx!.fillText(badge, left + 2 + badgeW / 2, middle);
      textLeft = left + badgeW + 7;
    }

    const textRight = left + width - 5;
    const label = fit(text, textRight - textLeft);
    if (!label) return;
    ctx!.fillStyle = COLOR.bubbleText;
    if (badge) {
      ctx!.textAlign = 'left';
      ctx!.fillText(label, textLeft, middle);
      return;
    }
    // Keep the label inside the visible part of a bubble that runs off screen.
    const half = textWidth(label) / 2;
    ctx!.textAlign = 'center';
    ctx!.fillText(label, clamp((left + right) / 2, textLeft + half, textRight - half), middle);
  }

  function drawChannel(ch: Channel, index: number, pxPerDay: number, from: number, to: number) {
    const row = rowAt(rulerH + index * rowH);
    const visibleFrom = Math.max(from, captureStart);
    const visibleTo = Math.min(to, captureEnd);
    if (visibleTo <= visibleFrom) return;

    if (index === selected && selectedFrame >= 0) {
      const frame = ch.layout[selectedFrame];
      if (frame) {
        ctx!.fillStyle = COLOR.frameHighlight;
        ctx!.fillRect(x(frame.t0), row.top, Math.max(2, x(frame.t1) - x(frame.t0)), rowH - 1);
      }
    }

    const bitwise = ch.bit * pxPerDay >= BIT_PX;
    collectEdges(ch, visibleFrom, visibleTo, bitwise);
    const y = (level: 0 | 1) => (level ? row.high : row.low);
    let level = bitwise ? levelAt(ch, visibleFrom) : spanLevelAt(ch, visibleFrom);
    const trace = new Path2D();
    trace.moveTo(x(visibleFrom), y(level));
    for (let i = 0; i < edgeTimes.length; i++) {
      const edge = Math.round(x(edgeTimes[i])) + 0.5;
      trace.lineTo(edge, y(level));
      level = edgeLevels[i];
      trace.lineTo(edge, y(level));
    }
    trace.lineTo(x(visibleTo), y(level));
    ctx!.strokeStyle = ch.color;
    ctx!.lineWidth = 1.5;
    ctx!.stroke(trace);

    if (!bitwise) {
      // Too dense to resolve: fill each frame solid, merging frames that touch on screen.
      ctx!.fillStyle = ch.color;
      ctx!.globalAlpha = 0.78;
      let runStart = NaN;
      let runEnd = NaN;
      const flush = () => {
        const left = Math.floor(runStart);
        ctx!.fillRect(left, row.high, Math.max(1, Math.ceil(runEnd) - left), row.low - row.high);
      };
      for (const frame of ch.layout) {
        if (frame.t1 < from) continue;
        if (frame.t0 > to) break;
        const x0 = x(frame.t0);
        const x1 = x(frame.t1);
        if (Number.isNaN(runStart)) {
          runStart = x0;
          runEnd = x1;
        } else if (x0 - runEnd < 1.5) {
          runEnd = x1;
        } else {
          flush();
          runStart = x0;
          runEnd = x1;
        }
      }
      if (!Number.isNaN(runStart)) flush();
      ctx!.globalAlpha = 1;
    }

    if (ch.layout.length === 0) return;
    ctx!.font = bubbleFont;
    ctx!.textBaseline = 'middle';
    const lod = lodOf(ch, pxPerDay);
    if (lod === 'merged') {
      const first = ch.layout[0];
      const last = ch.layout[ch.layout.length - 1];
      bubble(x(first.t0), x(last.t1), row, ch.analyzer, ch.frames.join(' · '), String(ch.layout.length));
      return;
    }
    for (const frame of ch.layout) {
      if (frame.t1 < from) continue;
      if (frame.t0 > to) break;
      if (lod === 'frames') {
        bubble(x(frame.t0), x(frame.t1), row, ch.analyzer, frame.text);
        continue;
      }
      const byteTime = ch.bit * BITS_PER_BYTE;
      const first = Math.max(0, Math.floor((from - frame.t0) / byteTime));
      const last = Math.min(frame.bytes.length - 1, Math.floor((to - frame.t0) / byteTime));
      for (let k = first; k <= last; k++) {
        const start = frame.t0 + k * byteTime;
        bubble(x(start), x(start + byteTime), row, ch.analyzer, byteLabel(frame.bytes[k]));
      }
    }
  }

  function drawRuler(ticks: { major: Tick[]; minor: number[] }) {
    ctx!.fillStyle = COLOR.ruler;
    ctx!.fillRect(0, 0, W, rulerH);
    ctx!.fillStyle = COLOR.separator;
    ctx!.fillRect(0, rulerH - 1, W, 1);

    ctx!.fillStyle = COLOR.tick;
    for (const t of ticks.minor) ctx!.fillRect(Math.round(x(t)), rulerH - 5, 1, 4);

    ctx!.font = `500 11px ${FONT}`;
    ctx!.textBaseline = 'middle';
    ctx!.textAlign = 'left';
    let lastRight = -Infinity;
    for (const tick of ticks.major) {
      const at = Math.round(x(tick.t));
      ctx!.fillStyle = COLOR.tick;
      ctx!.fillRect(at, rulerH - 10, 1, 9);
      const labelW = ctx!.measureText(tick.label).width;
      let labelX = at + 5;
      // Keep scale labels fully inside the ruler instead of clipping at the right edge.
      if (labelX + labelW > W - 4) labelX = Math.max(4, W - 4 - labelW);
      if (labelX < lastRight + 8 || labelX + labelW < 0) continue;
      ctx!.fillStyle = tick.strong ? COLOR.rulerStrong : COLOR.rulerText;
      ctx!.fillText(tick.label, labelX, rulerH / 2 - 1);
      lastRight = labelX + labelW;
    }

    const nowX = x(captureEnd);
    if (nowX > -40 && nowX < W + 40) {
      ctx!.font = `600 10px ${FONT}`;
      const flagW = Math.ceil(ctx!.measureText('Now').width) + 10;
      const flagH = rulerH - 12;
      const flagX = clamp(Math.round(nowX) - flagW / 2, 2, W - flagW - 2);
      ctx!.fillStyle = COLOR.now;
      roundRect(flagX, 6, flagW, flagH, 3);
      ctx!.fillStyle = '#fff';
      ctx!.textAlign = 'center';
      ctx!.fillText('Now', flagX + flagW / 2, 6 + flagH / 2 + 0.5);
    }
  }

  function draw() {
    raf = 0;
    const frameTime = performance.now();
    if (anim) stepAnimation(frameTime);

    let sweepX = Infinity;
    if (sweep) {
      const progress = (frameTime - sweep.start) / SWEEP_MS;
      if (progress >= 1) stopSweep();
      else sweepX = progress * clamp(x(captureEnd), 0, W);
    }

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.fillStyle = COLOR.background;
    ctx!.fillRect(0, 0, W, H);

    const pxPerDay = W / (b - a);
    const from = a - 2 / pxPerDay;
    const to = b + 2 / pxPerDay;

    for (let i = 0; i < channels.length; i++) {
      if (i !== selected && i !== hoverRow) continue;
      ctx!.fillStyle = i === selected ? COLOR.selectedRow : COLOR.hoverRow;
      ctx!.fillRect(0, rulerH + i * rowH, W, rowH);
    }

    const startX = x(captureStart);
    const endX = x(captureEnd);
    ctx!.fillStyle = COLOR.noData;
    if (startX > 0) ctx!.fillRect(0, rulerH, Math.min(startX, W), H - rulerH);
    if (endX < W) ctx!.fillRect(Math.max(0, endX), rulerH, W - Math.max(0, endX), H - rulerH);

    const ticks = ticksFor(pxPerDay);
    ctx!.fillStyle = COLOR.grid;
    for (const tick of ticks.major) ctx!.fillRect(Math.round(x(tick.t)), rulerH, 1, H - rulerH);
    ctx!.fillStyle = COLOR.separator;
    for (let i = 1; i <= channels.length; i++) ctx!.fillRect(0, rulerH + i * rowH - 1, W, 1);

    if (rowH >= 52) {
      ctx!.font = `600 9px ${FONT}`;
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'middle';
      ctx!.fillStyle = COLOR.level;
      for (let i = 0; i < channels.length; i++) {
        const row = rowAt(rulerH + i * rowH);
        ctx!.fillText('H', 3, row.high - 6);
        ctx!.fillText('L', 3, row.low - 6);
      }
    }

    ctx!.save();
    if (Number.isFinite(sweepX)) {
      ctx!.beginPath();
      ctx!.rect(0, rulerH, sweepX, H - rulerH);
      ctx!.clip();
    }
    channels.forEach((ch, i) => drawChannel(ch, i, pxPerDay, from, to));
    ctx!.restore();

    if (endX >= 0 && endX <= W) {
      ctx!.fillStyle = COLOR.now;
      ctx!.fillRect(Math.round(endX), rulerH, 1, H - rulerH);
    }

    if (hoverRow >= 0 && !drag && !sweep) {
      const ch = channels[hoverRow];
      const end = ch.ongoing ? captureEnd : ch.t1;
      const t = time(hoverX);
      if (t >= ch.t0 && t <= end) {
        const row = rowAt(rulerH + hoverRow * rowH);
        const middle = Math.round((row.high + row.low) / 2);
        ctx!.fillStyle = COLOR.rise;
        ctx!.beginPath();
        ctx!.arc(x(ch.t0), middle, 4, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = COLOR.fall;
        ctx!.fillRect(Math.round(x(end)) - 4, middle - 4, 8, 8);
      }
    }

    drawRuler(ticks);

    const scale = formatScale((100 * (b - a)) / W);
    if (scale !== lastScale && scaleValue) {
      scaleValue.textContent = scale;
      lastScale = scale;
    }
    if (anim || sweep) requestDraw();
  }

  // ---- View -------------------------------------------------------------------------------

  function clampWindow(from: number, to: number): [number, number] {
    const span = clamp(to - from, MIN_SPAN, maxSpan);
    const center = clamp((from + to) / 2, captureStart, captureEnd);
    return [center - span / 2, center + span / 2];
  }

  function setWindow(from: number, to: number) {
    [a, b] = clampWindow(from, to);
    requestDraw();
  }

  /** `factor` > 1 zooms in, keeping the time under `px` fixed. */
  function zoomAt(factor: number, px: number) {
    anim = null;
    const span = b - a;
    const anchor = a + (px / W) * span;
    const next = clamp(span / factor, MIN_SPAN, maxSpan);
    const from = anchor - (px / W) * next;
    setWindow(from, from + next);
    refreshHover();
  }

  function panBy(px: number) {
    anim = null;
    const shift = (px * (b - a)) / W;
    setWindow(a + shift, b + shift);
    refreshHover();
  }

  function animateTo(from: number, to: number, duration = 420) {
    const [targetA, targetB] = clampWindow(from, to);
    if (reducedMotion.matches || duration <= 0) {
      anim = null;
      a = targetA;
      b = targetB;
    } else {
      anim = { a0: a, b0: b, a1: targetA, b1: targetB, start: performance.now(), duration };
    }
    requestDraw();
  }

  /** Zoom on a log scale, moving the center in step with the zoom so the target never leaves view. */
  function stepAnimation(frameTime: number) {
    if (!anim) return;
    const progress = Math.min(1, (frameTime - anim.start) / anim.duration);
    const eased = 1 - (1 - progress) ** 3;
    const span0 = anim.b0 - anim.a0;
    const span1 = anim.b1 - anim.a1;
    const span = Math.exp(Math.log(span0) + (Math.log(span1) - Math.log(span0)) * eased);
    const weight = Math.abs(span1 - span0) > span0 * 1e-6 ? (span - span0) / (span1 - span0) : eased;
    const center0 = (anim.a0 + anim.b0) / 2;
    const center = center0 + ((anim.a1 + anim.b1) / 2 - center0) * weight;
    a = center - span / 2;
    b = center + span / 2;
    if (progress >= 1) anim = null;
  }

  function targetWindow(): [number, number] {
    return anim ? [anim.a1, anim.b1] : [a, b];
  }

  function zoomCenter(factor: number) {
    const [from, to] = targetWindow();
    const center = (from + to) / 2;
    const span = clamp((to - from) / factor, MIN_SPAN, maxSpan);
    animateTo(center - span / 2, center + span / 2, 220);
  }

  function panStep(fraction: number) {
    const [from, to] = targetWindow();
    const shift = (to - from) * fraction;
    animateTo(from + shift, to + shift, 180);
  }

  const fitWindow = (): [number, number] => {
    const pad = (captureEnd - captureStart) * 0.025;
    return [captureStart - pad, captureEnd + pad];
  };

  /** Fit this channel's UART payload across the wave view. */
  function zoomToChannel(index: number) {
    const ch = channels[index];
    if (!ch) return;
    const start = ch.layout[0]?.t0 ?? ch.t0;
    const end = ch.layout.length
      ? ch.layout[ch.layout.length - 1].t1
      : ch.ongoing
        ? captureEnd
        : ch.t1;
    const span = Math.max(end - start, ch.bit * BITS_PER_BYTE);
    const pad = span * 0.06;
    animateTo(start - pad, end + pad);
  }

  function zoomToFrame(index: number, frameIndex: number) {
    const frame = channels[index]?.layout[frameIndex];
    if (!frame) return;
    const pad = (frame.t1 - frame.t0) * 0.15;
    animateTo(frame.t0 - pad, frame.t1 + pad);
  }

  /** ⌘/Ctrl + arrow: center the next edge of the selected channel, or of any channel. */
  function jumpEdge(direction: 1 | -1) {
    const pool = selected >= 0 ? channels[selected].edges : channels.flatMap((ch) => [ch.t0, ...(ch.ongoing ? [] : [ch.t1])]);
    const [from, to] = targetWindow();
    const center = (from + to) / 2;
    const epsilon = (to - from) * 0.002;
    const sorted = [...pool].sort((p, q) => p - q);
    const target =
      direction > 0 ? sorted.find((t) => t > center + epsilon) : sorted.reverse().find((t) => t < center - epsilon);
    if (target === undefined) return;
    const half = (to - from) / 2;
    animateTo(target - half, target + half, 260);
  }

  // ---- Selection and panel ----------------------------------------------------------------

  function select(index: number, frameIndex = -1) {
    const changed = index !== selected;
    selected = index;
    selectedFrame = index >= 0 ? frameIndex : -1;
    const id = index >= 0 ? channels[index].id : null;
    for (const label of labels) label.setAttribute('aria-pressed', String(label.dataset.channel === id));
    for (const section of sections) {
      const active = section.dataset.panelFor === id;
      section.hidden = !active;
      for (const button of section.querySelectorAll<HTMLElement>('[data-frame]')) {
        if (active && Number(button.dataset.frame) === selectedFrame) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
    }
    if (defaultSection) defaultSection.hidden = id !== null;
    if (changed && panel) panel.scrollTop = 0;
    requestDraw();
  }

  function hitTest(px: number, py: number): { index: number; frame: number } | null {
    const index = Math.floor((py - rulerH) / rowH);
    if (py < rulerH || index < 0 || index >= channels.length) return null;
    const ch = channels[index];
    const t = time(px);
    const pxPerDay = W / (b - a);
    const slack = 3 / pxPerDay;
    const frame =
      lodOf(ch, pxPerDay) === 'merged' ? -1 : ch.layout.findIndex((f) => t >= f.t0 - slack && t <= f.t1 + slack);
    return { index, frame };
  }

  // ---- Hover readout ----------------------------------------------------------------------

  function hideTip() {
    if (tip) tip.hidden = true;
  }

  function refreshHover() {
    if (hoverRow >= 0) updateTip();
  }

  function updateTip() {
    if (!tip || !tipTitle || !tipRows) return;
    if (hoverRow < 0 || drag || sweep) return hideTip();
    const ch = channels[hoverRow];
    const end = ch.ongoing ? captureEnd : ch.t1;
    const t = time(hoverX);
    if (t < ch.t0 || t > end) return hideTip();

    const rows: [string, string][] = [
      ['Width', `${formatDuration(ch.t0 * DAY_MS, end * DAY_MS)}${ch.ongoing ? ' so far' : ''}`],
    ];
    const lod = lodOf(ch, W / (b - a));
    const frameIndex = ch.layout.findIndex((f) => t >= f.t0 && t < f.t1);
    if (frameIndex >= 0 && lod !== 'merged') {
      const frame = ch.layout[frameIndex];
      rows.push(['Frame', `${frameIndex} · ${frame.text}`]);
      if (lod === 'bytes') {
        const byte = frame.bytes[Math.floor((t - frame.t0) / (ch.bit * BITS_PER_BYTE))];
        if (byte !== undefined) rows.push(['Byte', `${byteHex(byte)} · ${byteLabel(byte)}`]);
      }
    }

    tipTitle.textContent = ch.title;
    tipRows.replaceChildren(
      ...rows.map(([term, value]) => {
        const line = document.createElement('div');
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = term;
        dd.textContent = value;
        line.append(dt, dd);
        return line;
      }),
    );
    tip.hidden = false;
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    let left = hoverX + 14;
    if (left + width > W - 6) left = hoverX - width - 14;
    let top = hoverY + 16;
    if (top + height > H - 6) top = hoverY - height - 12;
    tip.style.transform = `translate(${Math.round(Math.max(6, left))}px, ${Math.round(Math.max(6, top))}px)`;
  }

  // ---- Hints, help, replay ----------------------------------------------------------------

  function showHint(text: string, duration = 1800) {
    if (!hint) return;
    hint.textContent = text;
    hint.hidden = false;
    hint.dataset.show = 'true';
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => delete hint.dataset.show, duration);
  }

  function engage(pointerType: string) {
    if (engaged) return;
    engaged = true;
    root.dataset.engaged = 'true';
    if (pointerType !== 'touch' && !engageHintShown) {
      engageHintShown = true;
      showHint('Scrolling now zooms the capture. Press Esc to release.', 2600);
    }
  }

  function disengage() {
    if (!engaged) return;
    engaged = false;
    delete root.dataset.engaged;
  }

  function toggleHelp(force?: boolean) {
    if (!help) return;
    const show = force ?? help.hidden;
    help.hidden = !show;
    for (const button of helpButtons) button.setAttribute('aria-pressed', String(show));
  }

  function setScaleMenu(open: boolean) {
    if (!scaleMenu || !scaleButton) return;
    scaleMenu.hidden = !open;
    scaleButton.setAttribute('aria-expanded', String(open));
  }

  function startSweep() {
    if (reducedMotion.matches) return;
    sweep = { start: performance.now() };
    startButton?.setAttribute('data-running', 'true');
    startButton?.setAttribute('aria-label', 'Stop replay');
    hideTip();
    requestDraw();
  }

  function stopSweep() {
    sweep = null;
    startButton?.removeAttribute('data-running');
    startButton?.setAttribute('aria-label', 'Replay the capture');
    requestDraw();
  }

  // ---- Input ------------------------------------------------------------------------------

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  let wheelAxis: 'x' | 'y' | null = null;
  let wheelTimer = 0;
  let gesturing = false;
  let gestureScale = 1;

  wave.addEventListener(
    'wheel',
    (event) => {
      if (gesturing) {
        event.preventDefault();
        return;
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? H : 1;
      let dx = event.deltaX * unit;
      let dy = event.deltaY * unit;
      if (event.shiftKey && dx === 0) {
        dx = dy;
        dy = 0;
      }
      const px = local(event).x;

      // Trackpad pinches arrive as wheel events with ctrlKey set.
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        zoomAt(Math.exp(-clamp(dy, -40, 40) * 0.012), px);
        return;
      }

      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => (wheelAxis = null), 180);
      wheelAxis ??= Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';

      if (wheelAxis === 'x') {
        event.preventDefault();
        panBy(dx);
        return;
      }
      if (engaged) {
        event.preventDefault();
        zoomAt(Math.exp(-clamp(dy, -80, 80) * 0.0035), px);
        return;
      }
      if (performance.now() - lastScrollHint > 4000) {
        lastScrollHint = performance.now();
        showHint(`Pinch or ${isMac ? '⌘' : 'Ctrl'} + scroll to zoom. Swipe sideways to pan.`);
      }
    },
    { passive: false },
  );

  // Safari reports trackpad pinches as gesture events instead of ctrl + wheel.
  type GestureLike = Event & { scale: number; clientX: number; clientY: number };
  wave.addEventListener('gesturestart', (event) => {
    event.preventDefault();
    gesturing = true;
    gestureScale = 1;
  });
  wave.addEventListener('gesturechange', (event) => {
    event.preventDefault();
    const gesture = event as GestureLike;
    zoomAt(gesture.scale / gestureScale, local(gesture).x);
    gestureScale = gesture.scale;
  });
  wave.addEventListener('gestureend', (event) => {
    event.preventDefault();
    gesturing = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = local(event);
    pointers.set(event.pointerId, point);
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // The pointer was already released (a very quick tap); capture isn't needed then.
    }
    engage(event.pointerType);
    anim = null;
    if (pointers.size === 1) {
      drag = { id: event.pointerId, x: point.x, sx: point.x, sy: point.y, moved: false };
    } else if (pointers.size === 2) {
      const [p, q] = [...pointers.values()];
      pinch = { dist: Math.hypot(p.x - q.x, p.y - q.y), mid: (p.x + q.x) / 2 };
      if (drag) drag.moved = true;
      hideTip();
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = local(event);
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, point);
      if (pinch && pointers.size >= 2) {
        const [p, q] = [...pointers.values()];
        const dist = Math.max(1, Math.hypot(p.x - q.x, p.y - q.y));
        const mid = (p.x + q.x) / 2;
        zoomAt(dist / pinch.dist, mid);
        panBy(pinch.mid - mid);
        pinch = { dist, mid };
        return;
      }
      if (drag?.id === event.pointerId) {
        if (!drag.moved && Math.hypot(point.x - drag.sx, point.y - drag.sy) > 4) {
          drag.moved = true;
          root.dataset.dragging = 'true';
          hideTip();
        }
        if (drag.moved) panBy(drag.x - point.x);
        drag.x = point.x;
        return;
      }
    }
    if (event.pointerType === 'touch') return;
    const row = point.y >= rulerH ? Math.floor((point.y - rulerH) / rowH) : -1;
    const nextRow = row >= 0 && row < channels.length ? row : -1;
    hoverX = point.x;
    hoverY = point.y;
    if (nextRow !== hoverRow) hoverRow = nextRow;
    updateTip();
    requestDraw();
  });

  const release = (event: PointerEvent) => {
    const ended = drag?.id === event.pointerId ? drag : null;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (ended) {
      drag = null;
      delete root.dataset.dragging;
      if (!ended.moved && event.type === 'pointerup') {
        const point = local(event);
        const hit = hitTest(point.x, point.y);
        if (hit) {
          select(hit.index, hit.frame);
          if (hit.frame >= 0) zoomToFrame(hit.index, hit.frame);
          else zoomToChannel(hit.index);
        }
      }
    }
    if (pointers.size === 1 && !drag) {
      const [[id, point]] = [...pointers.entries()];
      drag = { id, x: point.x, sx: point.x, sy: point.y, moved: true };
    }
    requestDraw();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch' || drag) return;
    hoverRow = -1;
    hideTip();
    requestDraw();
  });

  canvas.addEventListener('dblclick', (event) => {
    const px = local(event).x;
    const [from, to] = targetWindow();
    const anchor = from + (px / W) * (to - from);
    const span = clamp((to - from) / (event.shiftKey || event.altKey ? 1 / 2.5 : 2.5), MIN_SPAN, maxSpan);
    animateTo(anchor - (px / W) * span, anchor + (1 - px / W) * span, 280);
  });

  root.addEventListener('keydown', (event) => {
    const mod = event.metaKey || event.ctrlKey;
    switch (event.key) {
      case 'ArrowLeft':
        if (mod) jumpEdge(-1);
        else panStep(event.shiftKey ? -0.5 : -0.2);
        break;
      case 'ArrowRight':
        if (mod) jumpEdge(1);
        else panStep(event.shiftKey ? 0.5 : 0.2);
        break;
      case 'ArrowUp':
        zoomCenter(1.6);
        break;
      case 'ArrowDown':
        zoomCenter(1 / 1.6);
        break;
      case '=':
      case '+':
        if (mod) return;
        zoomCenter(1.6);
        break;
      case '-':
      case '_':
        if (mod) return;
        zoomCenter(1 / 1.6);
        break;
      case '0':
        if (mod) return;
        animateTo(...fitWindow());
        break;
      case '?':
        toggleHelp();
        break;
      case 'Escape':
        if (help && !help.hidden) toggleHelp(false);
        else if (scaleMenu && !scaleMenu.hidden) setScaleMenu(false);
        else if (selected >= 0) select(-1);
        else disengage();
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!root.contains(event.target as Node)) disengage();
    if (scaleMenu && !scaleMenu.hidden && !(event.target as Element).closest?.('[data-scale-wrap]')) setScaleMenu(false);
  });
  document.addEventListener('wheel', (event) => {
    if (!wave.contains(event.target as Node)) disengage();
  }, { passive: true });
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget as Node | null)) disengage();
  });

  for (const label of labels) {
    const index = indexOf.get(label.dataset.channel ?? '') ?? -1;
    label.addEventListener('click', () => {
      select(index);
      zoomToChannel(index);
    });
  }

  panel?.addEventListener('click', (event) => {
    const target = event.target as Element;
    const frameButton = target.closest<HTMLElement>('[data-frame]');
    if (frameButton) {
      const index = indexOf.get(frameButton.closest<HTMLElement>('[data-panel-for]')?.dataset.panelFor ?? '') ?? -1;
      const frame = Number(frameButton.dataset.frame);
      select(index, frame);
      zoomToFrame(index, frame);
    } else if (target.closest('[data-zoom-channel]')) {
      zoomToChannel(selected);
    } else if (target.closest('[data-clear]')) {
      select(-1);
    }
  });

  // Links elsewhere on the page (like the résumé list) can point at a channel.
  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest?.<HTMLElement>('[data-select-channel]');
    const index = link ? indexOf.get(link.dataset.selectChannel ?? '') : undefined;
    if (index === undefined) return;
    event.preventDefault();
    root.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
    select(index);
    zoomToChannel(index);
  });

  root.querySelector('[data-zoom="in"]')?.addEventListener('click', () => zoomCenter(1.6));
  root.querySelector('[data-zoom="out"]')?.addEventListener('click', () => zoomCenter(1 / 1.6));
  root.querySelector('[data-zoom="fit"]')?.addEventListener('click', () => animateTo(...fitWindow()));
  scaleButton?.addEventListener('click', () => setScaleMenu(scaleMenu?.hidden ?? false));
  scaleMenu?.addEventListener('click', (event) => {
    const option = (event.target as Element).closest<HTMLElement>('[data-preset]');
    if (!option) return;
    const [from, to] = targetWindow();
    const center = (from + to) / 2;
    const span = (Number(option.dataset.preset) * W) / 100;
    animateTo(center - span / 2, center + span / 2, 320);
    setScaleMenu(false);
  });
  startButton?.addEventListener('click', () => (sweep ? stopSweep() : startSweep()));
  panelButton?.addEventListener('click', () => {
    const show = root.dataset.panel === 'off';
    root.dataset.panel = show ? 'on' : 'off';
    panelButton.setAttribute('aria-pressed', String(show));
  });
  for (const button of helpButtons) button.addEventListener('click', () => toggleHelp());

  // Durations of ongoing work depend on today's date, not the build date.
  for (const element of root.querySelectorAll<HTMLElement>('[data-width]')) {
    const ch = channels[indexOf.get(element.dataset.width ?? '') ?? -1];
    if (ch) element.textContent = formatDuration(ch.t0 * DAY_MS, (ch.ongoing ? captureEnd : ch.t1) * DAY_MS);
  }

  // ---- Sizing -----------------------------------------------------------------------------

  const cssNumber = (name: string, fallback: number) => {
    const value = parseFloat(getComputedStyle(root).getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };

  function resize() {
    const width = Math.round(wave!.clientWidth);
    if (width === 0) return;
    const nextRow = cssNumber('--cap-row', 56);
    const nextRuler = cssNumber('--cap-ruler', 28);
    const height = nextRuler + channels.length * nextRow;
    const ratio = window.devicePixelRatio || 1;
    if (width === W && height === H && ratio === dpr) return;
    const first = W === 0;
    W = width;
    H = height;
    rowH = nextRow;
    rulerH = nextRuler;
    dpr = ratio;
    canvas!.width = Math.round(W * dpr);
    canvas!.height = Math.round(H * dpr);
    setBubbleFont(rowH < 52 ? 10 : 11);
    // Default to Fit so channels and UART text aren't mid-word / flat on first paint.
    if (first) [a, b] = fitWindow();
    if (raf) cancelAnimationFrame(raf);
    draw();
  }

  new ResizeObserver(resize).observe(wave);
  resize();
  root.dataset.ready = 'true';
  document.fonts?.ready.then(() => {
    widths.clear();
    fits.clear();
    requestDraw();
  });
}
