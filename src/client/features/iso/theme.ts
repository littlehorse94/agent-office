// Each floor its own look in the isometric office: its project's floor tint, the colours of the rugs
// under its pods, and props that are its own (a cat tree on Meow Money, stacks of coins on Ma Money,
// an easel in the studio...), set round the edge of the room where there are no desks. Picked by the
// project's name, else by a hash of it, so every floor looks the same each time.
import * as THREE from 'three';
import { FLOOR } from '../../../shared/layout';
import type { Ctx } from '../../core/context';
import { store } from '../../state';
import { mesh, toon } from '../../world/toon';
import type { Pod } from './rooms';

type Prop = 'cattree' | 'yarn' | 'coins' | 'safe' | 'easel' | 'paint' | 'screen' | 'trophy' | 'globe' | 'magnifier' | 'chart' | 'bell' | 'lamp' | 'books';

interface FloorTheme {
  name: string;
  tint: string;
  rugs: string[];
  props: Prop[];
}

const THEMES: { match: RegExp; theme: FloorTheme }[] = [
  { match: /dashboard/i, theme: { name: '🏢 HQ Command', tint: '#eef2ff', rugs: ['#c9d6f7', '#d7e3ff', '#bfd7f2', '#e0e4fb'], props: ['screen', 'trophy', 'chart', 'screen'] } },
  { match: /macatting-hq|hq$/i, theme: { name: '📚 Strategy Library', tint: '#fff3e2', rugs: ['#f3d9b1', '#efc9a0', '#e8d5b7', '#f6e2c3'], props: ['books', 'globe', 'lamp', 'books'] } },
  { match: /studio/i, theme: { name: '🎨 Creative Studio', tint: '#fff0f6', rugs: ['#f7c6dd', '#e0c3fc', '#ffd6e0', '#cdb4db'], props: ['easel', 'paint', 'easel', 'lamp'] } },
  { match: /crm/i, theme: { name: '📞 Sales Floor', tint: '#effbf3', rugs: ['#b7e4c7', '#d8f3dc', '#a7d7c5', '#cfeee0'], props: ['bell', 'chart', 'trophy', 'bell'] } },
  { match: /meow/i, theme: { name: '🐾 Meow Money', tint: '#fff4fa', rugs: ['#ffd1e8', '#ffe5ec', '#fbc4ab', '#f8d7e8'], props: ['cattree', 'yarn', 'coins', 'yarn'] } },
  { match: /money/i, theme: { name: '💰 Money Lab', tint: '#f2fff0', rugs: ['#cdeac0', '#e2f5c4', '#b9e3a6', '#d9f2d0'], props: ['coins', 'safe', 'chart', 'coins'] } },
  { match: /seo/i, theme: { name: '🔎 SEO Lab', tint: '#eefaff', rugs: ['#bde0fe', '#a2d2ff', '#cde7f0', '#d6eaf8'], props: ['magnifier', 'chart', 'screen', 'magnifier'] } },
  { match: /life/i, theme: { name: '🧠 Second Brain', tint: '#f5f0ff', rugs: ['#ddd1f5', '#e9e1fb', '#cbc0f0', '#efe7ff'], props: ['books', 'lamp', 'globe', 'books'] } },
];

const FALLBACK: FloorTheme[] = [
  { name: '🌿 Green Room', tint: '#f2fbf2', rugs: ['#cfe8cf', '#e0f0d8', '#c4e0d0', '#dcefe2'], props: ['lamp', 'books', 'globe', 'trophy'] },
  { name: '🌅 Sunset Room', tint: '#fff2ea', rugs: ['#ffd6c2', '#ffe1b8', '#f9c9b6', '#ffe9d6'], props: ['lamp', 'chart', 'paint', 'trophy'] },
];

export function themeFor(name: string): FloorTheme {
  const t = THEMES.find((t) => t.match.test(name))?.theme;
  if (t) return t;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK[Math.abs(h) % FALLBACK.length];
}

/** Puts the floor you're on in its theme (again, when you change floor). */
export function isoTheme(ctx: Ctx, pods: () => Pod[]) {
  const props = new THREE.Group();
  ctx.scene.add(props);
  /** Each material's own colour, from before any theme, to tint from. */
  const original = new WeakMap<THREE.MeshToonMaterial, THREE.Color>();
  let applied = '';

  function apply() {
    const f = store.currentFloor();
    if (!f) return;
    const ps = pods();
    const key = `${f.id}|${ps.length}`;
    if (key === applied || !ps.length) return;
    applied = key;
    const theme = themeFor(`${f.repo ?? ''} ${f.name}`);
    const box = new THREE.Box3();
    ctx.office.group.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.MeshToonMaterial;
      if (!m.isMesh || Array.isArray(mat) || !mat?.color) return;
      box.setFromObject(m);
      const w = box.max.x - box.min.x;
      const d = box.max.z - box.min.z;
      if (box.max.y > 0.05 || box.min.y < -0.05 || w * d < 6) return;
      if (!original.has(mat)) original.set(mat, mat.color.clone());
      const base = original.get(mat)!;
      // The floor itself: tinted.
      if (w * d > 150) return void mat.color.copy(base).multiply(new THREE.Color(theme.tint));
      // A rug under a pod: its pod's colour.
      const c = box.getCenter(new THREE.Vector3());
      const i = ps.findIndex((p) => Math.hypot(p.center.x - c.x, p.center.z - c.z) < 1.2);
      if (i >= 0) mat.color.set(theme.rugs[i % theme.rugs.length]);
    });
    placeProps(theme, ps);
    store.emit('floors');
  }

  /** The theme's props, round the room's edge, wherever no desk is near. */
  function placeProps(theme: FloorTheme, ps: Pod[]) {
    props.clear();
    const y = ps[0].center.y - 0.4;
    const spots: [number, number][] = [];
    for (let x = FLOOR.minX + 2; x <= FLOOR.maxX - 2; x += 3) spots.push([x, FLOOR.minZ + 1.6], [x, FLOOR.maxZ - 1.6]);
    for (let z = FLOOR.minZ + 3; z <= FLOOR.maxZ - 3; z += 3) spots.push([FLOOR.minX + 1.6, z], [FLOOR.maxX - 1.6, z]);
    const desks = ps.flatMap((p) => p.desks.map((d) => d.group.getWorldPosition(new THREE.Vector3())));
    const clear = spots.filter(([x, z]) => desks.every((d) => Math.hypot(d.x - x, d.z - z) > 3));
    // Spread out: every few spots round the edge.
    const step = Math.max(1, Math.floor(clear.length / 8));
    let n = 0;
    for (let i = 0; i < clear.length && n < 8; i += step, n++) {
      const prop = build(theme.props[n % theme.props.length]);
      prop.position.set(clear[i][0], Math.max(0, y), clear[i][1]);
      prop.rotation.y = (n * Math.PI) / 3;
      props.add(prop);
    }
  }

  return { apply, nameOf: () => themeFor(`${store.currentFloor()?.repo ?? ''} ${store.currentFloor()?.name ?? ''}`).name };
}

// ---- The props: a few shapes each, in the office's toon style ----------------------------------------
const C = { gold: '#f4c542', wood: '#b07f48', ink: '#2b2d42', white: '#ffffff', red: '#ef476f', blue: '#5bc0eb', green: '#06d6a0', pink: '#ffafcc', grey: '#8d99ae', cream: '#fff3e2' };

function build(kind: Prop): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => g.add(mesh(geo, toon(color), x, y, z));
  switch (kind) {
    case 'cattree':
      add(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 10), C.cream, 0, 0.7, 0);
      for (const [y, r] of [[0.05, 0.45], [0.75, 0.32], [1.4, 0.38]] as const) add(new THREE.CylinderGeometry(r, r, 0.08, 18), C.pink, 0, y, 0);
      add(new THREE.SphereGeometry(0.1, 12, 10), C.red, 0.25, 0.9, 0);
      break;
    case 'yarn':
      for (const [x, c] of [[0, C.red], [0.32, C.blue], [-0.25, C.green]] as const) {
        add(new THREE.SphereGeometry(0.16, 14, 12), c, x, 0.16, (x * 0.7) % 0.2);
      }
      break;
    case 'coins':
      for (let i = 0; i < 3; i++) for (let k = 0; k < 4 + i * 2; k++) add(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16), C.gold, i * 0.32 - 0.32, 0.03 + k * 0.055, (i % 2) * 0.2);
      break;
    case 'safe':
      add(new THREE.BoxGeometry(0.7, 0.75, 0.6), C.grey, 0, 0.38, 0);
      add(new THREE.TorusGeometry(0.12, 0.03, 8, 20), C.gold, 0, 0.42, 0.31);
      break;
    case 'easel':
      for (const sx of [-1, 1]) {
        const leg = mesh(new THREE.BoxGeometry(0.05, 1.6, 0.05), toon(C.wood), sx * 0.3, 0.8, 0);
        leg.rotation.z = sx * -0.15;
        g.add(leg);
      }
      add(new THREE.BoxGeometry(0.8, 0.6, 0.04), C.white, 0, 1.15, 0.06);
      add(new THREE.BoxGeometry(0.5, 0.3, 0.01), C.pink, 0, 1.18, 0.09);
      break;
    case 'paint':
      for (const [x, c] of [[0, C.red], [0.32, C.blue], [0.16, C.gold]] as const) add(new THREE.CylinderGeometry(0.13, 0.13, 0.28, 14), c, x, 0.14, x * 0.6 - 0.1);
      break;
    case 'screen':
      add(new THREE.BoxGeometry(0.08, 1.0, 0.08), C.ink, 0, 0.5, 0);
      add(new THREE.BoxGeometry(1.3, 0.8, 0.08), C.ink, 0, 1.3, 0);
      g.add(mesh(new THREE.BoxGeometry(1.16, 0.66, 0.02), toon('#7ad3f0', { emissive: '#3aa7d0' }), 0, 1.3, 0.05));
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.16, 0.12 + i * 0.1, 0.02), C.green, -0.4 + i * 0.27, 1.06 + (0.12 + i * 0.1) / 2, 0.07);
      break;
    case 'trophy':
      add(new THREE.BoxGeometry(0.4, 0.5, 0.4), C.wood, 0, 0.25, 0);
      add(new THREE.CylinderGeometry(0.16, 0.06, 0.3, 14), C.gold, 0, 0.7, 0);
      add(new THREE.TorusGeometry(0.1, 0.025, 8, 16), C.gold, 0.17, 0.72, 0);
      break;
    case 'globe':
      add(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 14), C.wood, 0, 0.04, 0);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), C.wood, 0, 0.4, 0);
      add(new THREE.SphereGeometry(0.28, 18, 14), C.blue, 0, 0.95, 0);
      add(new THREE.SphereGeometry(0.12, 10, 8), C.green, 0.12, 1.05, 0.18);
      break;
    case 'magnifier':
      g.add(mesh(new THREE.TorusGeometry(0.35, 0.06, 10, 24), toon(C.ink), 0, 1.0, 0));
      g.add(mesh(new THREE.CircleGeometry(0.32, 24), toon('#cdeffd', { transparent: true, opacity: 0.6 }), 0, 1.0, 0.01));
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), C.wood, 0, 0.4, 0);
      break;
    case 'chart':
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.2, 0.3 + i * 0.25, 0.2), [C.blue, C.green, C.gold, C.red][i], -0.36 + i * 0.24, (0.3 + i * 0.25) / 2, 0);
      break;
    case 'bell':
      add(new THREE.CylinderGeometry(0.2, 0.25, 0.9, 12), C.wood, 0, 0.45, 0);
      add(new THREE.ConeGeometry(0.2, 0.25, 16), C.gold, 0, 1.03, 0);
      break;
    case 'lamp':
      add(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), C.ink, 0, 0.75, 0);
      add(new THREE.CylinderGeometry(0.18, 0.25, 0.08, 14), C.ink, 0, 0.04, 0);
      g.add(mesh(new THREE.ConeGeometry(0.28, 0.3, 16, 1, true), toon('#ffe6a7', { emissive: '#ffd166' }), 0, 1.55, 0));
      break;
    case 'books':
      for (let i = 0; i < 5; i++) {
        const b = mesh(new THREE.BoxGeometry(0.12, 0.42, 0.32), toon([C.red, C.blue, C.green, C.gold, C.pink][i]), -0.3 + i * 0.14, 0.21, 0);
        b.rotation.z = i === 4 ? 0.3 : 0;
        g.add(b);
      }
      break;
  }
  return g;
}
