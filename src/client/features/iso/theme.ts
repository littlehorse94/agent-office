// Each floor its own place in the isometric office, picked by its project's name: its walls, floor,
// desks and chairs in colours of its own, its pods' rugs, a centrepiece that's only its (the Money
// Lab's vault, Meow Money's cat corner, the SEO Lab's server racks...) and props round the edge of the
// room. Every prop reacts when it's clicked (see react in pick.ts). Only this floor's look changes: the
// materials it recolours are its own copies, and the same floor looks the same every time.
import * as THREE from 'three';
import { FLOOR } from '../../../shared/layout';
import type { Ctx } from '../../core/context';
import { store } from '../../state';
import type { Pod } from './rooms';
import { build, CENTREPIECES, type Centrepiece, type Prop } from './props';

interface FloorTheme {
  name: string;
  floor: string;
  walls: string;
  desks: string;
  chairs: string[];
  rugs: string[];
  centrepiece: Centrepiece;
  props: Prop[];
}

const THEMES: { match: RegExp; theme: FloorTheme }[] = [
  { match: /dashboard/i, theme: { name: '🏢 HQ Command', floor: '#9aa7c7', walls: '#3d4a6b', desks: '#e9edf7', chairs: ['#2b2d42', '#4361ee'], rugs: ['#4361ee', '#3a0ca3', '#4895ef', '#560bad'], centrepiece: 'boardroom', props: ['screen', 'trophy', 'chart', 'screen', 'flag', 'plant'] } },
  { match: /macatting-hq|hq$/i, theme: { name: '📚 Strategy Library', floor: '#c99a6b', walls: '#6b4226', desks: '#8b5a3c', chairs: ['#7f1d1d', '#a16207'], rugs: ['#7f1d1d', '#9a3412', '#854d0e', '#3f6212'], centrepiece: 'library', props: ['books', 'globe', 'lamp', 'books', 'plant', 'lamp'] } },
  { match: /studio/i, theme: { name: '🎨 Creative Studio', floor: '#ffffff', walls: '#ffafcc', desks: '#ffffff', chairs: ['#ff006e', '#8338ec', '#ffbe0b'], rugs: ['#ff006e', '#8338ec', '#3a86ff', '#ffbe0b'], centrepiece: 'gallery', props: ['easel', 'paint', 'easel', 'lamp', 'plant', 'paint'] } },
  { match: /crm/i, theme: { name: '📞 Sales Floor', floor: '#b7e4c7', walls: '#1b4332', desks: '#f1faee', chairs: ['#2d6a4f', '#40916c'], rugs: ['#2d6a4f', '#52b788', '#1b4332', '#74c69d'], centrepiece: 'stage', props: ['bell', 'chart', 'trophy', 'bell', 'plant', 'screen'] } },
  { match: /meow/i, theme: { name: '🐾 Meow Money', floor: '#ffe5ec', walls: '#ff8fab', desks: '#fff0f3', chairs: ['#fb6f92', '#ffc2d1'], rugs: ['#ffb3c6', '#ff8fab', '#fb6f92', '#ffc2d1'], centrepiece: 'catcorner', props: ['cattree', 'yarn', 'coins', 'yarn', 'fishbowl', 'cattree'] } },
  { match: /money/i, theme: { name: '💰 Money Lab', floor: '#d8f3dc', walls: '#14532d', desks: '#fefae0', chairs: ['#166534', '#ca8a04'], rugs: ['#166534', '#ca8a04', '#15803d', '#a16207'], centrepiece: 'vault', props: ['coins', 'safe', 'chart', 'coins', 'plant', 'screen'] } },
  { match: /seo/i, theme: { name: '🔎 SEO Lab', floor: '#caf0f8', walls: '#023e8a', desks: '#ffffff', chairs: ['#0077b6', '#00b4d8'], rugs: ['#0077b6', '#00b4d8', '#023e8a', '#48cae4'], centrepiece: 'servers', props: ['magnifier', 'chart', 'screen', 'magnifier', 'plant', 'chart'] } },
  { match: /life/i, theme: { name: '🧠 Second Brain', floor: '#e9e1fb', walls: '#5a189a', desks: '#f8f4ff', chairs: ['#7b2cbf', '#c77dff'], rugs: ['#9d4edd', '#c77dff', '#7b2cbf', '#e0aaff'], centrepiece: 'brain', props: ['books', 'lamp', 'globe', 'books', 'plant', 'lamp'] } },
];

const FALLBACK: FloorTheme[] = [
  { name: '🌿 Green Room', floor: '#e8f5e9', walls: '#2e7d32', desks: '#ffffff', chairs: ['#43a047', '#fbc02d'], rugs: ['#a5d6a7', '#81c784', '#c5e1a5', '#aed581'], centrepiece: 'library', props: ['lamp', 'books', 'globe', 'trophy', 'plant'] },
  { name: '🌅 Sunset Room', floor: '#ffe0cc', walls: '#c2410c', desks: '#fff7ed', chairs: ['#ea580c', '#f59e0b'], rugs: ['#fdba74', '#fb923c', '#fcd34d', '#fca5a5'], centrepiece: 'stage', props: ['lamp', 'chart', 'paint', 'trophy', 'plant'] },
];

export function themeFor(name: string): FloorTheme {
  const t = THEMES.find((t) => t.match.test(name))?.theme;
  if (t) return t;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK[Math.abs(h) % FALLBACK.length];
}

const floorName = () => `${store.currentFloor()?.repo ?? ''} ${store.currentFloor()?.name ?? ''}`;

/** Puts the floor you're on in its theme (again, when you change floor). */
export function isoTheme(ctx: Ctx, pods: () => Pod[]) {
  const props = new THREE.Group();
  ctx.scene.add(props);
  /** Each mesh's own material (or materials, one a face) from before any theme, to recolour copies of. */
  const original = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
  let applied = '';
  const box = new THREE.Box3();
  const c = new THREE.Vector3();

  /** Gives `mesh` a copy of its own material, in `color` (or multiplied by it, to keep its pattern). */
  function paint(mesh: THREE.Mesh, color: string, multiply = false) {
    if (!original.has(mesh)) original.set(mesh, mesh.material);
    const base = original.get(mesh)!;
    const tint = new THREE.Color(color);
    const recolour = (b: THREE.Material, now: THREE.Material) => {
      const from = (b as THREE.MeshToonMaterial).color;
      if (!from) return now;
      const copy = (now === b ? b.clone() : now) as THREE.MeshToonMaterial;
      copy.color.copy(multiply ? from.clone().multiply(tint) : tint);
      return copy;
    };
    if (Array.isArray(base)) {
      const now = mesh.material as THREE.Material[];
      mesh.material = base.map((b, i) => recolour(b, now[i]));
    } else mesh.material = recolour(base, mesh.material as THREE.Material);
  }

  function apply() {
    const f = store.currentFloor();
    if (!f) return;
    const ps = pods();
    const key = `${f.id}|${ps.length}`;
    if (key === applied || !ps.length) return;
    applied = key;
    const theme = themeFor(floorName());
    const y = ps[0].center.y;

    // The desks and their chairs.
    const deskParts = new Set<THREE.Object3D>();
    ps.forEach((p, pi) =>
      p.desks.forEach((d, di) => {
        d.chair.traverse((o) => {
          deskParts.add(o);
          if ((o as THREE.Mesh).isMesh) paint(o as THREE.Mesh, theme.chairs[(pi + di) % theme.chairs.length]);
        });
        d.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || deskParts.has(o)) return;
          deskParts.add(o);
          box.setFromObject(m);
          const top = box.max.y - y;
          // The desktop: the widest, flattest piece at desk height.
          if (top > 0.6 && top < 0.95 && box.max.x - box.min.x > 0.8) paint(m, theme.desks);
        });
      }),
    );

    // The floor, the walls and the rugs.
    ctx.office.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || deskParts.has(o) || props.children.includes(o)) return;
      box.setFromObject(m);
      if (box.isEmpty()) return;
      const w = box.max.x - box.min.x;
      const d = box.max.z - box.min.z;
      const h = box.max.y - box.min.y;
      const flat = box.max.y - y < 0.5 && box.min.y - y > -0.5 && h < 0.1;
      if (flat && w * d > 150) return paint(m, theme.floor, true);
      if (flat && w * d > 6) {
        box.getCenter(c);
        const i = ps.findIndex((p) => Math.hypot(p.center.x - c.x, p.center.z - c.z) < 1.2);
        if (i >= 0) paint(m, theme.rugs[i % theme.rugs.length]);
        return;
      }
      // A wall: tall, thin, standing on the floor, along the room's edge.
      const thin = Math.min(w, d) < 0.6 && Math.max(w, d) > 2;
      box.getCenter(c);
      const edge = c.x < FLOOR.minX + 1.5 || c.x > FLOOR.maxX - 1.5 || c.z < FLOOR.minZ + 1.5 || c.z > FLOOR.maxZ - 1.5;
      if (thin && edge && h > 2.4 && box.min.y - y < 0.6) paint(m, theme.walls, true);
    });

    placeProps(theme, ps, y);
    store.emit('floors');
  }

  /** Whether a spot on the floor is clear of the office's own things (and of every desk), by `r` m. */
  function clear(x: number, z: number, r: number, desks: THREE.Vector3[], y: number): boolean {
    if (desks.some((d) => Math.hypot(d.x - x, d.z - z) < r + 1.6)) return false;
    return ctx.office.colliders.every((k) => (k.bottom ?? 0) > y + 2 || k.top < y + 0.05 || x < k.minX - r || x > k.maxX + r || z < k.minZ - r || z > k.maxZ + r);
  }

  /** The centrepiece in the room's most open spot, then the props round its edge. */
  function placeProps(theme: FloorTheme, ps: Pod[], y: number) {
    props.clear();
    const desks = ps.flatMap((p) => p.desks.map((d) => d.group.getWorldPosition(new THREE.Vector3())));
    // The centrepiece: the clear spot nearest the middle of the room with the most room round it.
    const big = CENTREPIECES[theme.centrepiece];
    let best: [number, number] | null = null;
    for (let x = FLOOR.minX + 3; x <= FLOOR.maxX - 3; x += 1)
      for (let z = FLOOR.minZ + 3; z <= FLOOR.maxZ - 3; z += 1) {
        if (!clear(x, z, big.radius, desks, y)) continue;
        if (!best || Math.hypot(x, z) < Math.hypot(...best)) best = [x, z];
      }
    if (best) {
      const g = build(theme.centrepiece);
      g.position.set(best[0], y, best[1]);
      props.add(g);
    }
    const taken = best ? [new THREE.Vector3(best[0], y, best[1])] : [];
    const spots: [number, number][] = [];
    for (let x = FLOOR.minX + 1.4; x <= FLOOR.maxX - 1.4; x += 1.5) spots.push([x, FLOOR.minZ + 1.4], [x, FLOOR.maxZ - 1.4]);
    for (let z = FLOOR.minZ + 2.9; z <= FLOOR.maxZ - 2.9; z += 1.5) spots.push([FLOOR.minX + 1.4, z], [FLOOR.maxX - 1.4, z]);
    let n = 0;
    for (const [x, z] of spots) {
      if (n >= 12) break;
      if (!clear(x, z, 0.6, [...desks, ...taken.map((t) => t.clone().setY(-999))], y)) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < (t === taken[0] && best ? big.radius + 1 : 2.4))) continue;
      const g = build(theme.props[n % theme.props.length]);
      g.position.set(x, y, z);
      g.rotation.y = Math.atan2(-x, -z);
      props.add(g);
      taken.push(new THREE.Vector3(x, y, z));
      n++;
    }
  }

  return { apply, nameOf: () => themeFor(floorName()).name, props };
}
