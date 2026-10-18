import { ANALYZER_COLORS, CHANNEL_COLORS } from './palette';
import { BITS_PER_BYTE, bitLevel, byteLabel, toBytes } from './uart';

const BIT_US = 1e6 / 115_200;

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const n = (value: number) => Number(value.toFixed(1));

/**
 * A still logic-analyzer capture of `texts` sent over UART at 115200 baud, one channel each,
 * with per-byte decode bubbles. Used as the cover for projects that don't have a photo.
 */
export function captureArt(texts: string[], label: string, { width: WIDTH = 700, height: HEIGHT = 500 } = {}): string {
  const rows = texts.slice(0, 4);
  const ruler = 34;
  const left = 56;
  const rowH = (HEIGHT - ruler) / Math.max(rows.length, 1);
  const payloads = rows.map(toBytes);
  const maxBytes = Math.max(1, ...payloads.map((bytes) => bytes.length));
  const bitW = (WIDTH - left - 28) / (maxBytes * BITS_PER_BYTE + 6);
  const origin = left + 3 * bitW;
  const out: string[] = [
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>`,
    `<rect width="${WIDTH}" height="${ruler}" fill="#ffffff"/>`,
    `<rect y="${ruler - 1}" width="${WIDTH}" height="1" fill="#e5e7eb"/>`,
  ];

  const stepUs = [50, 100, 200, 250, 500, 1000, 2000].find((us) => (us / BIT_US) * bitW >= 110) ?? 5000;
  for (let us = 0; ; us += stepUs) {
    const x = n(origin + (us / BIT_US) * bitW);
    if (x > WIDTH) break;
    const text = us >= 1000 ? `+${us / 1000} ms` : `+${us} µs`;
    out.push(
      `<rect x="${x}" y="${ruler}" width="1" height="${HEIGHT - ruler}" fill="#eef0f3"/>`,
      `<rect x="${x}" y="${ruler - 10}" width="1" height="9" fill="#d1d5db"/>`,
      `<text x="${n(x + 5)}" y="${ruler / 2 + 5}" fill="#667085" font-size="14">${text}</text>`,
    );
  }

  rows.forEach((_, i) => {
    const top = ruler + i * rowH;
    const bubbleH = 20;
    const bubbleY = n(top + rowH * 0.16);
    const high = Math.round(top + rowH * 0.5) + 0.5;
    const low = Math.round(top + rowH * 0.84) + 0.5;
    const bytes = payloads[i];

    if (i > 0) out.push(`<rect y="${n(top)}" width="${WIDTH}" height="1" fill="#e5e7eb"/>`);
    out.push(`<text x="14" y="${n((high + low) / 2 + 5)}" fill="#98a2b3" font-size="14">D${i}</text>`);

    let path = `M${left} ${high}`;
    let level = 1;
    bytes.forEach((byte, b) => {
      for (let k = 0; k < BITS_PER_BYTE; k++) {
        const next = bitLevel(byte, k);
        if (next === level) continue;
        path += `H${n(origin + (b * BITS_PER_BYTE + k) * bitW)}V${next ? high : low}`;
        level = next;
      }
    });
    path += `H${WIDTH}`;
    out.push(`<path d="${path}" fill="none" stroke="${CHANNEL_COLORS[i]}" stroke-width="1.5"/>`);

    bytes.forEach((byte, b) => {
      const x = origin + b * BITS_PER_BYTE * bitW;
      const w = BITS_PER_BYTE * bitW - 2;
      out.push(
        `<rect x="${n(x)}" y="${bubbleY}" width="${n(w)}" height="${bubbleH}" rx="2" fill="${ANALYZER_COLORS.project}"/>`,
      );
      if (w >= 14) {
        out.push(
          `<text x="${n(x + w / 2)}" y="${n(bubbleY + bubbleH / 2 + 5)}" fill="#141415" font-size="14" font-weight="500" text-anchor="middle">${escape(byteLabel(byte))}</text>`,
        );
      }
    });
  });

  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(label)}" font-family="Inter Variable, Inter, system-ui, sans-serif">${out.join('')}</svg>`;
}
