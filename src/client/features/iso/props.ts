// The isometric office's own props and centrepieces, a few toon shapes each, and what each does when
// it's clicked (userData.react, see pick.ts): a pop of an emoji, a few words, and how it moves.
import * as THREE from 'three';
import { mesh, toon } from '../../world/toon';

export type Prop = 'cattree' | 'yarn' | 'coins' | 'safe' | 'easel' | 'paint' | 'screen' | 'trophy' | 'globe' | 'magnifier' | 'chart' | 'bell' | 'lamp' | 'books' | 'plant' | 'flag' | 'fishbowl';
export type Centrepiece = 'boardroom' | 'library' | 'gallery' | 'stage' | 'catcorner' | 'vault' | 'servers' | 'brain';

/** How a thing moves when it's clicked. */
export type Move = 'bounce' | 'spin' | 'wobble' | 'grow' | 'glow';

export interface React {
  emoji: string;
  /** What it says (the tip, and a toast when used). */
  label: string;
  says: string[];
  move: Move;
}

/** Room each centrepiece needs round its middle (m). */
export const CENTREPIECES: Record<Centrepiece, { radius: number }> = {
  boardroom: { radius: 2.4 },
  library: { radius: 2 },
  gallery: { radius: 2.2 },
  stage: { radius: 2.2 },
  catcorner: { radius: 2 },
  vault: { radius: 2 },
  servers: { radius: 2 },
  brain: { radius: 1.8 },
};

const C = { gold: '#f4c542', wood: '#b07f48', dark: '#6b4226', ink: '#2b2d42', white: '#ffffff', red: '#ef476f', blue: '#5bc0eb', green: '#06d6a0', pink: '#ffafcc', grey: '#8d99ae', cream: '#fff3e2', steel: '#adb5bd' };

const REACT: Record<Prop | Centrepiece, React> = {
  cattree: { emoji: '🐈', label: 'Cat tree', says: ['A cat leaps to the top!', 'Scratch scratch scratch'], move: 'wobble' },
  yarn: { emoji: '🧶', label: 'Balls of yarn', says: ['The yarn rolls away…', 'Tangled again'], move: 'spin' },
  coins: { emoji: '🪙', label: 'Coins', says: ['Ka-ching!', '+1 coin for the budget'], move: 'bounce' },
  safe: { emoji: '🔐', label: 'The safe', says: ['Locked tight', 'Nobody knows the combination'], move: 'wobble' },
  easel: { emoji: '🎨', label: 'Easel', says: ['A new masterpiece takes shape', 'Needs more pink'], move: 'wobble' },
  paint: { emoji: '🖌️', label: 'Paint pots', says: ['Splash!', 'Fresh colours'], move: 'bounce' },
  screen: { emoji: '📈', label: 'Dashboard screen', says: ['Numbers going up', 'Refreshing the stats…'], move: 'glow' },
  trophy: { emoji: '🏆', label: 'Trophy', says: ['Employee of the month!', 'Polished to a shine'], move: 'spin' },
  globe: { emoji: '🌍', label: 'Globe', says: ['Spinning to a new market…', 'Startups worldwide'], move: 'spin' },
  magnifier: { emoji: '🔎', label: 'Magnifier', says: ['Found a keyword!', 'Zooming in on the SERPs'], move: 'wobble' },
  chart: { emoji: '📊', label: 'Chart', says: ['Up and to the right', 'Q4 looks good'], move: 'grow' },
  bell: { emoji: '🛎️', label: 'Sales bell', says: ['DING! A deal closed!', 'Ring it for every win'], move: 'wobble' },
  lamp: { emoji: '💡', label: 'Lamp', says: ['Click', 'Cosy light'], move: 'glow' },
  books: { emoji: '📖', label: 'Books', says: ['A good read', 'Strategy, chapter 3'], move: 'bounce' },
  plant: { emoji: '💧', label: 'Plant', says: ['Watered! It grows a little', 'Happy plant'], move: 'grow' },
  flag: { emoji: '🚩', label: 'Flag', says: ['MACATTING!', 'Flying high'], move: 'wobble' },
  fishbowl: { emoji: '🐟', label: 'Fish bowl', says: ['Blub blub', 'The cats are watching it'], move: 'wobble' },
  boardroom: { emoji: '🗣️', label: 'Boardroom', says: ['Meeting in session', 'Strategy time'], move: 'bounce' },
  library: { emoji: '📚', label: 'Library corner', says: ['Quiet please', 'So many ideas'], move: 'bounce' },
  gallery: { emoji: '🖼️', label: 'Gallery wall', says: ['Inspiration everywhere', 'Mood board updated'], move: 'wobble' },
  stage: { emoji: '🎤', label: 'Stage', says: ['Big announcement!', 'Pitch practice'], move: 'bounce' },
  catcorner: { emoji: '😺', label: 'Cat corner', says: ['Nap time', 'Purrrr'], move: 'wobble' },
  vault: { emoji: '💰', label: 'The vault', says: ['The vault creaks open…', 'Counting the gold'], move: 'wobble' },
  servers: { emoji: '🖥️', label: 'Server racks', says: ['Crawling the web…', 'All systems go'], move: 'glow' },
  brain: { emoji: '🧠', label: 'The second brain', says: ['A new idea sparks!', 'Remembering everything'], move: 'grow' },
};

/** Builds a prop or centrepiece, with what it does when clicked. */
export function build(kind: Prop | Centrepiece): THREE.Group {
  const g = new THREE.Group();
  g.userData.react = REACT[kind];
  const add = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, emissive?: string) => {
    const m = mesh(geo, toon(color, emissive ? { emissive } : {}), x, y, z);
    g.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, emissive?: string) => add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, emissive);
  const cyl = (r: number, h: number, color: string, x: number, y: number, z: number, top = r) => add(new THREE.CylinderGeometry(top, r, h, 16), color, x, y + h / 2, z);
  const ball = (r: number, color: string, x: number, y: number, z: number) => add(new THREE.SphereGeometry(r, 16, 12), color, x, y, z);
  const chair = (x: number, z: number, color: string, ry: number) => {
    const c = new THREE.Group();
    c.add(mesh(new THREE.BoxGeometry(0.45, 0.08, 0.45), toon(color), 0, 0.45, 0), mesh(new THREE.BoxGeometry(0.45, 0.5, 0.08), toon(color), 0, 0.72, -0.2), mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6), toon(C.ink), 0, 0.22, 0));
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    g.add(c);
  };
  switch (kind) {
    case 'cattree':
      cyl(0.08, 1.4, C.cream, 0, 0, 0);
      for (const [y, r] of [[0, 0.45], [0.7, 0.32], [1.36, 0.38]] as const) cyl(r, 0.08, C.pink, 0, y, 0);
      ball(0.1, C.red, 0.25, 0.9, 0);
      break;
    case 'yarn':
      for (const [x, c] of [[0, C.red], [0.32, C.blue], [-0.25, C.green]] as const) ball(0.16, c, x, 0.16, x * 0.4);
      break;
    case 'coins':
      for (let i = 0; i < 3; i++) for (let k = 0; k < 4 + i * 2; k++) cyl(0.14, 0.05, C.gold, i * 0.32 - 0.32, k * 0.055, (i % 2) * 0.2);
      break;
    case 'safe':
      box(0.7, 0.75, 0.6, C.grey, 0, 0, 0);
      add(new THREE.TorusGeometry(0.12, 0.03, 8, 20), C.gold, 0, 0.42, 0.31);
      break;
    case 'easel':
      for (const sx of [-1, 1]) {
        const leg = mesh(new THREE.BoxGeometry(0.05, 1.6, 0.05), toon(C.wood), sx * 0.3, 0.8, 0);
        leg.rotation.z = sx * -0.15;
        g.add(leg);
      }
      box(0.8, 0.6, 0.04, C.white, 0, 0.85, 0.06);
      box(0.5, 0.3, 0.01, C.pink, 0, 1.0, 0.09);
      break;
    case 'paint':
      for (const [x, c] of [[0, C.red], [0.32, C.blue], [0.16, C.gold]] as const) cyl(0.13, 0.28, c, x, 0, x * 0.6 - 0.1);
      break;
    case 'screen':
      box(0.08, 1.0, 0.08, C.ink, 0, 0, 0);
      box(1.3, 0.8, 0.08, C.ink, 0, 0.9, 0);
      box(1.16, 0.66, 0.02, '#7ad3f0', 0, 0.97, 0.05, '#3aa7d0');
      for (let i = 0; i < 4; i++) box(0.16, 0.12 + i * 0.1, 0.02, C.green, -0.4 + i * 0.27, 1.06, 0.07);
      break;
    case 'trophy':
      box(0.4, 0.5, 0.4, C.wood, 0, 0, 0);
      cyl(0.06, 0.3, C.gold, 0, 0.5, 0, 0.16);
      break;
    case 'globe':
      cyl(0.22, 0.08, C.wood, 0, 0, 0, 0.18);
      cyl(0.03, 0.7, C.wood, 0, 0.08, 0);
      ball(0.28, C.blue, 0, 0.95, 0);
      ball(0.12, C.green, 0.12, 1.05, 0.18);
      break;
    case 'magnifier':
      add(new THREE.TorusGeometry(0.35, 0.06, 10, 24), C.ink, 0, 1.0, 0);
      g.add(mesh(new THREE.CircleGeometry(0.32, 24), toon('#cdeffd', { transparent: true, opacity: 0.6 }), 0, 1.0, 0.01));
      cyl(0.05, 0.6, C.wood, 0, 0.1, 0);
      break;
    case 'chart':
      for (let i = 0; i < 4; i++) box(0.2, 0.3 + i * 0.25, 0.2, [C.blue, C.green, C.gold, C.red][i], -0.36 + i * 0.24, 0, 0);
      break;
    case 'bell':
      cyl(0.25, 0.9, C.wood, 0, 0, 0, 0.2);
      add(new THREE.ConeGeometry(0.2, 0.25, 16), C.gold, 0, 1.03, 0);
      break;
    case 'lamp':
      cyl(0.25, 0.08, C.ink, 0, 0, 0, 0.18);
      cyl(0.03, 1.5, C.ink, 0, 0, 0);
      g.add(mesh(new THREE.ConeGeometry(0.28, 0.3, 16, 1, true), toon('#ffe6a7', { emissive: '#ffd166' }), 0, 1.55, 0));
      break;
    case 'books':
      for (let i = 0; i < 5; i++) {
        const b = box(0.12, 0.42, 0.32, [C.red, C.blue, C.green, C.gold, C.pink][i], -0.3 + i * 0.14, 0, 0);
        b.rotation.z = i === 4 ? 0.3 : 0;
      }
      break;
    case 'plant':
      cyl(0.2, 0.35, '#e07a5f', 0, 0, 0, 0.25);
      ball(0.32, '#52b788', 0, 0.65, 0);
      ball(0.22, '#40916c', 0.18, 0.85, 0.05);
      ball(0.2, '#74c69d', -0.15, 0.9, -0.05);
      break;
    case 'flag':
      cyl(0.03, 1.8, C.steel, 0, 0, 0);
      box(0.7, 0.45, 0.02, '#ff8a5b', 0.37, 1.3, 0);
      break;
    case 'fishbowl':
      cyl(0.25, 0.5, C.wood, 0, 0, 0);
      g.add(mesh(new THREE.SphereGeometry(0.32, 18, 14), toon('#bde0fe', { transparent: true, opacity: 0.55 }), 0, 0.8, 0));
      ball(0.06, '#ff9f1c', 0.08, 0.78, 0.05);
      break;

    // ---- Centrepieces ----------------------------------------------------------------------------
    case 'boardroom':
      box(3.2, 0.08, 1.3, C.dark, 0, 0.72, 0);
      for (const x of [-1.3, 1.3]) box(0.1, 0.72, 1.0, C.ink, x, 0, 0);
      for (const x of [-1.1, -0.35, 0.4, 1.15]) for (const z of [-0.9, 0.9]) chair(x, z, '#2b2d42', z > 0 ? Math.PI : 0);
      box(1.4, 0.8, 0.06, C.ink, 0, 1.2, -1.4);
      box(1.3, 0.7, 0.02, '#7ad3f0', 0, 1.25, -1.36, '#3aa7d0');
      break;
    case 'library':
      for (const x of [-1, 0, 1]) {
        box(0.9, 2.1, 0.4, C.dark, x, 0, -0.8);
        for (const y of [0.4, 0.9, 1.4]) for (let i = 0; i < 6; i++) box(0.1, 0.36, 0.28, [C.red, C.blue, C.green, C.gold, C.pink, C.cream][i], x - 0.3 + i * 0.12, y, -0.75);
      }
      box(0.8, 0.45, 0.8, '#7f1d1d', 0, 0, 0.6);
      box(0.8, 0.5, 0.15, '#7f1d1d', 0, 0.45, 0.95);
      cyl(0.6, 0.03, '#d4a373', 0, 0, 0.4);
      break;
    case 'gallery':
      for (const [x, c] of [[-1.2, '#ff006e'], [0, '#3a86ff'], [1.2, '#ffbe0b']] as const) {
        box(0.05, 1.5, 0.05, C.wood, x - 0.3, 0, 0);
        box(0.05, 1.5, 0.05, C.wood, x + 0.3, 0, 0);
        box(0.9, 0.7, 0.04, C.white, x, 0.9, 0.05);
        box(0.6, 0.45, 0.01, c, x, 1.02, 0.08);
      }
      for (const [x, z, c] of [[-0.6, 0.9, '#ff006e'], [0.5, 1.1, '#8338ec'], [0.1, 0.6, '#ffbe0b']] as const) cyl(0.35, 0.01, c, x, 0.005, z);
      break;
    case 'stage':
      cyl(1.6, 0.25, C.dark, 0, 0, 0);
      box(0.5, 1.0, 0.4, C.wood, 0, 0.25, 0.3);
      cyl(0.02, 0.4, C.ink, 0, 1.25, 0.3);
      ball(0.06, C.ink, 0, 1.68, 0.3);
      box(2.4, 1.4, 0.08, '#40916c', 0, 0.25, -1.3);
      box(2.2, 0.9, 0.02, '#ffffff', 0, 0.55, -1.25);
      break;
    case 'catcorner':
      cyl(1.3, 0.02, '#ffc2d1', 0, 0, 0);
      cyl(0.12, 1.9, C.cream, -0.6, 0, -0.5);
      for (const [y, r] of [[0, 0.5], [0.8, 0.4], [1.85, 0.45]] as const) cyl(r, 0.08, C.pink, -0.6, y, -0.5);
      for (const [x, z] of [[0.6, 0.3], [0.1, 0.8]] as const) {
        cyl(0.35, 0.18, '#fb6f92', x, 0, z);
        cyl(0.27, 0.06, '#fff0f3', x, 0.12, z);
      }
      for (const [x, c] of [[0.8, C.red], [0.45, C.blue]] as const) ball(0.13, c, x, 0.13, -0.6);
      box(0.9, 0.5, 0.45, '#bde0fe', 0.7, 0, -0.9);
      break;
    case 'vault':
      box(2.0, 2.0, 0.4, C.steel, 0, 0, -0.7);
      add(new THREE.CylinderGeometry(0.75, 0.75, 0.15, 24), C.grey, 0, 1.0, -0.45).rotation.x = Math.PI / 2;
      add(new THREE.TorusGeometry(0.4, 0.05, 8, 24), C.gold, 0, 1.0, -0.35);
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3 - i; k++) box(0.45, 0.16, 0.22, C.gold, -0.45 + k * 0.48 + i * 0.24, i * 0.16, 0.5);
      break;
    case 'servers':
      for (const x of [-1, 0, 1]) {
        box(0.75, 2.0, 0.7, '#212529', x, 0, -0.5);
        for (let y = 0; y < 8; y++) box(0.5, 0.04, 0.02, y % 3 ? '#06d6a0' : '#5bc0eb', x, 0.25 + y * 0.22, -0.14, y % 3 ? '#06d6a0' : '#5bc0eb');
      }
      box(1.2, 0.75, 0.6, C.white, 0, 0, 0.8);
      box(0.6, 0.4, 0.04, C.ink, 0, 0.75, 0.7);
      break;
    case 'brain':
      cyl(0.5, 0.8, C.white, 0, 0, 0, 0.45);
      for (let i = 0; i < 9; i++) ball(0.28, i % 2 ? '#ffafcc' : '#ffc8dd', Math.cos(i * 0.7) * 0.3, 1.25 + Math.sin(i * 1.3) * 0.18, Math.sin(i * 0.7) * 0.25);
      for (const [x, z] of [[-1.2, 0.4], [1.2, 0.4]] as const) {
        cyl(0.03, 1.4, C.ink, x, 0, z);
        g.add(mesh(new THREE.SphereGeometry(0.18, 12, 10), toon('#ffe6a7', { emissive: '#ffd166' }), x, 1.45, z));
      }
      break;
  }
  return g;
}
