export interface Segment {
  text: string;
  mark: boolean;
}

const ELLIPSIS = /\s*(?:…|\.{3})\s*/;
const MIN_FRAGMENT_CHARS = 4;
const APOSTROPHES = "'’‘";

function escapeRegex(char: string): string {
  return /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

/** Regex that matches a quote regardless of whitespace, case and apostrophe style. */
function fragmentPattern(fragment: string): RegExp {
  const body = fragment
    .trim()
    .split("")
    .map((char) => {
      if (/\s/.test(char)) return "\\s+";
      if (APOSTROPHES.includes(char)) return `[${APOSTROPHES}]`;
      return escapeRegex(char);
    })
    .join("")
    .replace(/(\\s\+)+/g, "\\s+");
  return new RegExp(body, "i");
}

/** Split `passage` into plain and highlighted segments for the verified `quote`. */
export function highlightSegments(passage: string, quote: string): Segment[] {
  const ranges: Array<[number, number]> = [];
  let cursor = 0;
  for (const fragment of quote.split(ELLIPSIS)) {
    if (fragment.trim().length < MIN_FRAGMENT_CHARS) continue;
    const match = fragmentPattern(fragment).exec(passage.slice(cursor));
    if (!match) continue;
    const start = cursor + match.index;
    const end = start + match[0].length;
    ranges.push([start, end]);
    cursor = end;
  }
  if (ranges.length === 0) return [{ text: passage, mark: false }];

  const segments: Segment[] = [];
  let position = 0;
  for (const [start, end] of ranges) {
    if (start > position) segments.push({ text: passage.slice(position, start), mark: false });
    segments.push({ text: passage.slice(start, end), mark: true });
    position = end;
  }
  if (position < passage.length) segments.push({ text: passage.slice(position), mark: false });
  return segments;
}
