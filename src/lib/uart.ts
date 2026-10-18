/** Async serial framing, 8N1: a start bit, eight data bits LSB first, and a stop bit. */
export const BITS_PER_BYTE = 10;

const LOOKALIKES: Record<string, number> = { '‘': 0x27, '’': 0x27, '“': 0x22, '”': 0x22, '–': 0x2d, '—': 0x2d };

/** Latin-1 bytes for `text`. Characters outside Latin-1 go out as an ASCII look-alike, or `?`. */
export function toBytes(text: string): number[] {
  return Array.from(text, (char) => {
    const code = char.codePointAt(0) ?? 0x3f;
    return code <= 0xff ? code : (LOOKALIKES[char] ?? 0x3f);
  });
}

/** Line level during bit `index` (0–9) of the frame carrying `byte`. The line idles high. */
export function bitLevel(byte: number, index: number): 0 | 1 {
  if (index <= 0) return 0;
  if (index >= BITS_PER_BYTE - 1) return 1;
  return ((byte >> (index - 1)) & 1) as 0 | 1;
}

/** The character when it's printable, otherwise hex, the way a serial analyzer prints bytes. */
export function byteLabel(byte: number): string {
  if (byte === 0x20) return '␣';
  if ((byte > 0x20 && byte < 0x7f) || byte > 0xa0) return String.fromCharCode(byte);
  return `0x${byte.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function byteHex(byte: number): string {
  return `0x${byte.toString(16).toUpperCase().padStart(2, '0')}`;
}
