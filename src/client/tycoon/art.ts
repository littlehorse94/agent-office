// The tycoon view's art: Ma's PNG from the office's tycoon-art folder when there is one (see
// /api/tycoon), else a placeholder drawn here as SVG at the same size. Every sprite is drawn at 2x and
// shown at half, so `size(name)` is the size it takes on the page.
import { ART, type MinionPose } from '../../shared/tycoon';

let have = new Set<string>();

/** The art files that are there, from /api/tycoon. */
export function setArt(names: readonly string[]) {
  have = new Set(names);
}

/** Its size on the page, in CSS pixels (half the file's). */
export function size(name: string): [number, number] {
  const [w, h] = ART[name] ?? ART[name.replace(/^floor-.*/, 'floor').replace(/^minion-.*-(idle|working|needs-you|done)$/, 'minion-$1')] ?? [128, 128];
  return [w / 2, h / 2];
}

/** The first of `names` there's art for, as a URL; else the placeholder for the last of them. */
export function src(names: readonly string[], placeholder: () => string): string {
  for (const n of names) if (have.has(n)) return `/tycoon-art/${n}.png`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholder())}`;
}

export const hasArt = (name: string) => have.has(name);

// ---- Placeholders -------------------------------------------------------------------------------
// Flat shapes in the office's colors, in the same 2:1 isometric grid the real art uses.
const INK = '#2b2d42';
const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Lighter or darker by `k` (-1..1). */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** A floor tile, 256x128: a diamond. */
export const floorTile = (color: string) =>
  svg(256, 128, `<path d="M128 2 254 64 128 126 2 64Z" fill="${color}" stroke="${shade(color, -0.12)}" stroke-width="3"/>`);

/** A wall, 256x384: one wall standing on the tile's back-left edge (mirrored for the back-right). */
export const wall = () =>
  svg(
    256,
    384,
    `<path d="M2 320 128 258V2L2 64Z" fill="#f3e3cc" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M2 300 128 238" stroke="#d9c2a3" stroke-width="10"/>` +
      `<path d="M40 150 96 122v60l-56 28Z" fill="#bde4f4" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  );

/** A desk with a laptop, 256x256. */
export const desk = () =>
  svg(
    256,
    256,
    `<path d="M128 120 228 170 128 220 28 170Z" fill="#e6b980" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M28 170v22l100 50v-22Z" fill="#c8955a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M228 170v22l-100 50v-22Z" fill="#b07f48" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M112 160 158 183 136 194 90 171Z" fill="#8d99ae" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M112 160V118l46 23v42Z" fill="#5c677d" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M118 160v-32l34 17v32Z" fill="#7ad3f0"/>`,
  );

export const plant = () =>
  svg(
    256,
    256,
    `<path d="M100 196h56l-8 46h-40Z" fill="#e07a5f" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
      `<circle cx="128" cy="150" r="44" fill="#52b788" stroke="${INK}" stroke-width="4"/>` +
      `<circle cx="100" cy="120" r="30" fill="#74c69d" stroke="${INK}" stroke-width="4"/><circle cx="156" cy="118" r="28" fill="#40916c" stroke="${INK}" stroke-width="4"/>`,
  );

export const shelf = () =>
  svg(
    256,
    256,
    `<path d="M60 70 128 36v170l-68 34Z" fill="#a5714a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M128 36l68 34v170l-68-34Z" fill="#c68b5e" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
      [96, 140, 184].map((y) => `<path d="M136 ${y - 34}l52 26v8l-52-26Z" fill="${INK}"/><path d="M142 ${y - 58}h8v26h-8ZM156 ${y - 52}h8v26h-8ZM170 ${y - 44}h8v26h-8Z" fill="#ef476f"/>`).join(''),
  );

/** The sign over a room, 512x128; the room's name is written over it on the page. */
export const sign = (color: string) => svg(512, 128, `<rect x="6" y="14" width="500" height="100" rx="30" fill="${color}" stroke="${INK}" stroke-width="6"/>`);

/** A chibi minion, 128x192, facing front-right, in its pose. */
export function minion(color: string, pose: MinionPose): string {
  const skin = '#ffd8b5';
  const shirt = color;
  const arm = (d: string) => `<path d="${d}" fill="none" stroke="${shade(shirt, -0.2)}" stroke-width="12" stroke-linecap="round"/>`;
  const arms =
    pose === 'working'
      ? arm('M44 118 70 136') + arm('M84 118 104 132')
      : pose === 'done'
        ? arm('M44 112 28 76') + arm('M84 112 100 76')
        : pose === 'needs-you'
          ? arm('M44 118 40 146') + arm('M84 112 104 64')
          : arm('M44 118 40 148') + arm('M84 118 88 148');
  const face = pose === 'done' ? `<path d="M58 70q6 6 12 0M76 70q6 6 12 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` : `<circle cx="64" cy="70" r="5" fill="${INK}"/><circle cx="84" cy="72" r="5" fill="${INK}"/>`;
  const mouth = pose === 'needs-you' ? `<ellipse cx="76" cy="88" rx="6" ry="7" fill="${INK}"/>` : `<path d="M68 86q8 8 16 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  return svg(
    128,
    192,
    `<ellipse cx="64" cy="184" rx="34" ry="8" fill="rgba(43,45,66,.18)"/>` +
      `<path d="M50 150v28M78 150v28" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>` +
      `<rect x="38" y="104" width="52" height="54" rx="20" fill="${shirt}" stroke="${INK}" stroke-width="4"/>` +
      arms +
      `<circle cx="66" cy="72" r="38" fill="${skin}" stroke="${INK}" stroke-width="4"/>` +
      `<path d="M28 66q6-40 40-40t36 34q-24-14-46-6t-30 12Z" fill="${shade(shirt, -0.35)}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
      face +
      mouth,
  );
}

const ICON_EMOJI: Record<string, string> = {
  'icon-hire': '🧑‍💼',
  'icon-issues': '📌',
  'icon-prs': '🔀',
  'icon-queue': '📋',
  'icon-needs-you': '🙋',
  'icon-done': '✅',
  'icon-working': '💬',
};

/** An icon, 128x128: the emoji the office uses for it, on a disc. */
export const icon = (name: string) =>
  svg(128, 128, `<circle cx="64" cy="64" r="58" fill="#fff" stroke="${INK}" stroke-width="6"/><text x="64" y="86" font-size="64" text-anchor="middle">${ICON_EMOJI[name] ?? '❔'}</text>`);
