/** Interactive demos driven by firmware constants from Documents/stm (ENERGY_LOUD=1500, α=0.2). */

interface Telemetry {
  threshold: number;
  alpha: number;
  debounce: number;
  dtMs: number;
  timers: number[];
  samples: number[];
  energies: number[];
  flags: number[];
}

const FONT = '"Inter Variable", Inter, system-ui, sans-serif';

function be32(n: number, signed: boolean): number[] {
  const v = signed ? n | 0 : n >>> 0;
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}

function hex(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

export function mountWakeWordDemos(root: HTMLElement, data: Telemetry): void {
  const uart = mountUartInspector(root.querySelector<HTMLElement>('[data-uart-demo]')!, data);
  mountEnergyScrubber(root.querySelector<HTMLElement>('[data-energy-demo]')!, data, uart.setIndex);
}

function mountEnergyScrubber(
  root: HTMLElement,
  data: Telemetry,
  onIndex: (index: number) => void,
): void {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  const scrub = root.querySelector<HTMLInputElement>('[data-scrub]');
  const playBtn = root.querySelector<HTMLButtonElement>('[data-play]');
  const plotWell = root.querySelector<HTMLElement>('.plot-well') ?? canvas?.parentElement;
  const readouts = {
    sample: root.querySelector<HTMLElement>('[data-r-sample]'),
    energy: root.querySelector<HTMLElement>('[data-r-energy]'),
    flag: root.querySelector<HTMLElement>('[data-r-flag]'),
    time: root.querySelector<HTMLElement>('[data-r-time]'),
  };
  if (!canvas || !scrub || !playBtn || !plotWell) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const n = data.samples.length;
  scrub.max = String(n - 1);
  scrub.value = '0';

  let index = 0;
  let playing = false;
  let raf = 0;
  let lastTs = 0;
  let W = 0;
  let H = 0;
  let dpr = 1;

  const samplePeak = Math.max(1, ...data.samples.map(Math.abs));
  const energyPeak = Math.max(data.threshold * 1.2, ...data.energies);

  // Plot padding — kept in sync with draw() for hit-testing / scrub mapping.
  const padL = 8;
  const padR = 8;

  function resize() {
    // Measure the well, not the canvas — setting canvas.style.width in px was locking a
    // too-small size when getBoundingClientRect ran before layout settled.
    const rect = plotWell.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    draw();
  }

  function stopPlay() {
    if (!playing) return;
    playing = false;
    playBtn.textContent = 'Play';
    cancelAnimationFrame(raf);
  }

  function setIndex(next: number) {
    index = Math.max(0, Math.min(n - 1, Math.round(next)));
    scrub.value = String(index);
    const sample = data.samples[index];
    const energy = data.energies[index];
    const flag = data.flags[index];
    const timer = data.timers[index];
    if (readouts.sample) readouts.sample.textContent = String(sample);
    if (readouts.energy) readouts.energy.textContent = String(energy);
    if (readouts.flag) {
      readouts.flag.textContent = flag ? '1 · detect' : '0 · quiet';
      readouts.flag.dataset.on = String(flag);
    }
    if (readouts.time) readouts.time.textContent = `${timer} ms`;
    onIndex(index);
    draw();
  }

  function indexAtClientX(clientX: number): number {
    const rect = canvas.getBoundingClientRect();
    const plotW = Math.max(1, W - padL - padR);
    const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * W;
    const t = (x - padL) / plotW;
    return Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
  }

  function draw() {
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, W, H);
    ctx!.fillStyle = '#ffffff';
    ctx!.fillRect(0, 0, W, H);

    const padT = 10;
    const padB = 18;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const midY = padT + plotH * 0.38;
    const energyBase = padT + plotH * 0.92;

    const xAt = (i: number) => padL + (i / Math.max(1, n - 1)) * plotW;
    const ySample = (v: number) => midY - (v / samplePeak) * (plotH * 0.32);
    const yEnergy = (e: number) => energyBase - (e / energyPeak) * (plotH * 0.48);

    ctx!.strokeStyle = '#eef0f3';
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    ctx!.moveTo(padL, midY);
    ctx!.lineTo(padL + plotW, midY);
    ctx!.stroke();

    const thrY = yEnergy(data.threshold);
    ctx!.strokeStyle = '#f59e0b';
    ctx!.setLineDash([4, 4]);
    ctx!.beginPath();
    ctx!.moveTo(padL, thrY);
    ctx!.lineTo(padL + plotW, thrY);
    ctx!.stroke();
    ctx!.setLineDash([]);
    ctx!.fillStyle = '#b45309';
    ctx!.font = `500 10px ${FONT}`;
    ctx!.textAlign = 'left';
    ctx!.fillText(`threshold ${data.threshold}`, padL + 4, thrY - 4);

    // Ghost the full capture so load isn't a blank plot; brighten through the scrub head.
    const end = Math.max(0, Math.min(n - 1, index));

    const strokeSeries = (
      values: number[],
      yOf: (v: number) => number,
      color: string,
      width: number,
      alpha: number,
      last: number,
    ) => {
      if (last < 0) return;
      ctx!.globalAlpha = alpha;
      ctx!.strokeStyle = color;
      ctx!.lineWidth = width;
      ctx!.beginPath();
      for (let i = 0; i <= last; i++) {
        const x = xAt(i);
        const y = yOf(values[i]);
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.stroke();
      ctx!.globalAlpha = 1;
    };

    // Full traces (faint) — always visible on first paint.
    strokeSeries(data.samples, ySample, '#2563eb', 1.1, 0.18, n - 1);
    strokeSeries(data.energies, yEnergy, '#ea580c', 1.25, 0.2, n - 1);

    ctx!.fillStyle = 'rgb(34 197 94 / 0.14)';
    let runStart = -1;
    for (let i = 0; i <= end + 1; i++) {
      const on = i <= end && data.flags[i] === 1;
      if (on && runStart < 0) runStart = i;
      if (!on && runStart >= 0) {
        const x0 = xAt(runStart);
        const x1 = xAt(Math.max(runStart, i - 1));
        ctx!.fillRect(x0, padT, Math.max(2, x1 - x0), plotH);
        runStart = -1;
      }
    }

    strokeSeries(data.samples, ySample, '#2563eb', 1.25, 1, end);
    strokeSeries(data.energies, yEnergy, '#ea580c', 1.5, 1, end);

    // Playhead
    const headX = xAt(end);
    ctx!.strokeStyle = '#98a2b3';
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    ctx!.moveTo(headX, padT);
    ctx!.lineTo(headX, padT + plotH);
    ctx!.stroke();

    ctx!.font = `500 11px ${FONT}`;
    ctx!.textAlign = 'right';
    ctx!.fillStyle = '#2563eb';
    ctx!.fillText('PCM', W - padR, padT + 12);
    ctx!.fillStyle = '#ea580c';
    ctx!.fillText('energy', W - padR, padT + 26);
    ctx!.fillStyle = '#16a34a';
    ctx!.fillText('flag=1', W - padR, padT + 40);
  }

  scrub.addEventListener('input', () => {
    stopPlay();
    setIndex(Number(scrub.value));
  });

  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? 'Pause' : 'Play';
    if (playing) {
      lastTs = 0;
      const tick = (ts: number) => {
        if (!playing) return;
        if (!lastTs) lastTs = ts;
        if (ts - lastTs >= Math.max(16, data.dtMs)) {
          lastTs = ts;
          if (index >= n - 1) {
            stopPlay();
            return;
          }
          setIndex(index + 1);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
    }
  });

  // Trackpad: two-finger horizontal swipe scrubs. Vertical scroll stays with the page.
  plotWell.addEventListener(
    'wheel',
    (event) => {
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? W : 1;
      const dx = event.deltaX * scale;
      const dy = event.deltaY * scale;
      if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < 0.5) return;
      event.preventDefault();
      stopPlay();
      const steps = (dx / Math.max(W, 1)) * (n - 1);
      setIndex(index + steps);
    },
    { passive: false },
  );

  // Touch / mouse on the plot: drag or tap to seek; two fingers scrub by midpoint.
  const pointers = new Map<number, { x: number; y: number }>();
  let twoFinger: { startMidX: number; startIndex: number } | null = null;
  let oneFinger: { id: number; moved: boolean } | null = null;

  plotWell.style.touchAction = 'pan-y';

  plotWell.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    plotWell.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      const [p, q] = [...pointers.values()];
      twoFinger = { startMidX: (p.x + q.x) / 2, startIndex: index };
      oneFinger = null;
      stopPlay();
    } else if (pointers.size === 1) {
      twoFinger = null;
      oneFinger = { id: event.pointerId, moved: false };
    }
  });

  plotWell.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (twoFinger && pointers.size >= 2) {
      const [p, q] = [...pointers.values()];
      const midX = (p.x + q.x) / 2;
      const rect = canvas.getBoundingClientRect();
      const plotW = Math.max(1, rect.width * ((W - padL - padR) / Math.max(W, 1)));
      const deltaIdx = ((midX - twoFinger.startMidX) / plotW) * (n - 1);
      setIndex(twoFinger.startIndex + deltaIdx);
      return;
    }

    if (oneFinger && oneFinger.id === event.pointerId && pointers.size === 1) {
      oneFinger.moved = true;
      stopPlay();
      setIndex(indexAtClientX(event.clientX));
    }
  });

  const endPointer = (event: PointerEvent) => {
    const wasOne = oneFinger?.id === event.pointerId ? oneFinger : null;
    pointers.delete(event.pointerId);
    try {
      plotWell.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }

    if (wasOne && !wasOne.moved && pointers.size === 0) {
      stopPlay();
      setIndex(indexAtClientX(event.clientX));
    }

    if (pointers.size < 2) twoFinger = null;
    if (pointers.size === 0) oneFinger = null;
    else if (pointers.size === 1) {
      const [id, pt] = [...pointers.entries()][0];
      oneFinger = { id, moved: false };
      twoFinger = null;
      void pt;
    }
  };

  plotWell.addEventListener('pointerup', endPointer);
  plotWell.addEventListener('pointercancel', endPointer);
  const ro = new ResizeObserver(() => {
    // Defer one frame so percentage-based heights resolve against the laid-out well.
    requestAnimationFrame(resize);
  });
  ro.observe(plotWell);
  window.addEventListener('resize', resize);
  resize();
  setIndex(0);
}

function mountUartInspector(
  root: HTMLElement,
  data: Telemetry,
): { setIndex: (index: number) => void } {
  const bytesEl = root.querySelector<HTMLElement>('[data-bytes]');
  const fields = [...root.querySelectorAll<HTMLElement>('[data-field]')];
  if (!bytesEl || fields.length === 0) return { setIndex: () => undefined };

  const ranges: Record<string, [number, number]> = {
    sample: [0, 4],
    energy: [4, 8],
    flag: [8, 9],
    timer: [9, 13],
  };

  let active = 'sample';
  let frameIndex = 0;

  const paintHighlight = () => {
    for (const btn of bytesEl.querySelectorAll<HTMLElement>('.byte')) {
      btn.classList.toggle('is-on', btn.dataset.for === active);
    }
    for (const field of fields) {
      field.classList.toggle('is-on', field.dataset.field === active);
    }
    const [start, end] = ranges[active] ?? [0, 0];
    const span = root.querySelector<HTMLElement>('[data-range]');
    if (span) span.textContent = `bytes [${start}…${end - 1}]`;
  };

  const setIndex = (i: number) => {
    frameIndex = Math.max(0, Math.min(data.samples.length - 1, Math.round(i)));
    const sample = data.samples[frameIndex];
    const energy = data.energies[frameIndex];
    const flag = data.flags[frameIndex];
    const timer = data.timers[frameIndex];
    const bytes = [...be32(sample, true), ...be32(energy, false), flag & 0xff, ...be32(timer, false)];

    const decoded: Record<string, string> = {
      sample: `${sample} (int32 BE)`,
      energy: `${energy} (uint32 BE)`,
      flag: `${flag} — ${flag ? 'debounce passed' : 'quiet / warming up'}`,
      timer: `${timer} ms (uint32 BE)`,
    };

    bytesEl.innerHTML = bytes
      .map((b, idx) => {
        const field = idx < 4 ? 'sample' : idx < 8 ? 'energy' : idx === 8 ? 'flag' : 'timer';
        return `<button type="button" class="byte" data-byte="${idx}" data-for="${field}" aria-label="Byte ${idx}: 0x${hex(b)}">${hex(b)}</button>`;
      })
      .join('');

    for (const field of fields) {
      const key = field.dataset.field!;
      const value = field.querySelector<HTMLElement>('[data-value]');
      if (value) value.textContent = decoded[key] ?? '';
    }

    paintHighlight();
  };

  bytesEl.addEventListener('click', (event) => {
    const btn = (event.target as Element).closest<HTMLElement>('.byte');
    if (!btn?.dataset.for) return;
    active = btn.dataset.for;
    paintHighlight();
  });

  for (const field of fields) {
    field.addEventListener('click', () => {
      active = field.dataset.field ?? 'sample';
      paintHighlight();
    });
  }

  setIndex(0);
  return { setIndex };
}
