// The tycoon view's floor, drawn in 2:1 isometric from images placed on the page (no canvas, so every
// minion and desk is a button). A room per division of the roles on the building's floors (see
// shared/tycoon.ts), plus the open plan for workers hired without a role. Each room has a desk per
// worker in it and one spare to hire into. Grid x runs to the screen's lower right, grid y to its
// lower left; the walls stand along the building's two back edges only, so no room hides another.
import type { WorkerInfo } from '../../shared/protocol';
import { OPEN_PLAN, poseOf, roleOf, slug, type TycoonRole } from '../../shared/tycoon';
import * as art from './art';
import { h } from '../ui/dom';

/** A tile on the page: 128x64. */
const TW = 128;
const TH = 64;
/** Room width in tiles, and the corridor between rooms. */
const ROOM_W = 6;
const GAP = 1;

const ROOM_COLORS = ['#ffe8cc', '#d8f3dc', '#dbe7ff', '#fde2e4', '#fff3bf', '#e9d8fd', '#d0f4f7'];
const CORRIDOR = '#efe6da';

export interface Room {
  name: string;
  roles: TycoonRole[];
  workers: WorkerInfo[];
  color: string;
  /** Grid origin and size, in tiles. */
  x: number;
  y: number;
  w: number;
  d: number;
}

/** A desk: where it is, where its minion sits and which way it faces (true: front-left, mirrored). */
interface Seat {
  desk: [number, number];
  minion: [number, number];
  left: boolean;
}

const seatAt = (i: number): Seat => {
  const r = Math.floor(i / 2);
  return i % 2 === 0 ? { desk: [2, 2 + 2 * r], minion: [1, 2 + 2 * r], left: false } : { desk: [4, 2 + 2 * r], minion: [4, 1 + 2 * r], left: true };
};

/** The rooms of a floor, laid out on the grid. */
export function layoutRooms(roles: readonly TycoonRole[], workers: Iterable<WorkerInfo>): Room[] {
  const byRole = new Map(roles.map((r) => [r.id, r]));
  const rooms = new Map<string, Room>();
  const room = (name: string) => {
    let r = rooms.get(name);
    if (!r) rooms.set(name, (r = { name, roles: [], workers: [], color: ROOM_COLORS[rooms.size % ROOM_COLORS.length], x: 0, y: 0, w: ROOM_W, d: 0 }));
    return r;
  };
  for (const r of roles) room(r.division).roles.push(r);
  const agents = [...workers].sort((a, b) => a.createdAt - b.createdAt);
  for (const w of agents) room(byRole.get(roleOf(w.prompt) ?? '')?.division ?? OPEN_PLAN).workers.push(w);
  // Nobody's hired yet and there are no roles: an open plan to hire into all the same.
  if (!rooms.size) room(OPEN_PLAN);
  const list = [...rooms.values()];
  for (const r of list) r.d = 2 * Math.ceil(desksIn(r) / 2) + 2;
  // In a grid, as square as it goes.
  const cols = Math.ceil(Math.sqrt(list.length));
  let y = 0;
  for (let row = 0; row * cols < list.length; row++) {
    const inRow = list.slice(row * cols, row * cols + cols);
    inRow.forEach((r, i) => {
      r.x = i * (ROOM_W + GAP);
      r.y = y;
    });
    y += Math.max(...inRow.map((r) => r.d)) + GAP;
  }
  return list;
}

/** A desk per worker and one to spare. */
const desksIn = (r: Room) => Math.max(2, r.workers.length + 1);

export interface SceneActions {
  /** A minion was clicked. */
  open(workerId: string): void;
  /** A free desk was clicked: hire into this room. */
  hire(room: Room): void;
  roleName(workerId: string): string | undefined;
}

/** Draws the rooms into `world`, sized to fit them; returns its size. */
export function drawScene(world: HTMLElement, rooms: readonly Room[], act: SceneActions): { width: number; height: number } {
  const gw = Math.max(...rooms.map((r) => r.x + r.w));
  const gd = Math.max(...rooms.map((r) => r.y + r.d)) - GAP;
  // Room above for the walls and signs, and to the left for the grid's left corner.
  const ox = gd * (TW / 2) + 16;
  const oy = 200;
  const at = (gx: number, gy: number) => ({ x: (gx - gy) * (TW / 2) + ox, y: (gx + gy) * (TH / 2) + oy });
  const z = (gx: number, gy: number, sub: number) => String(10 + (gx + gy) * 4 + sub);
  const els: HTMLElement[] = [];
  const sprite = (names: string[], placeholder: () => string, x: number, y: number, zIndex: string, cls = '', flip = false) => {
    const [w, hgt] = art.size(names[names.length - 1]);
    const img = h(`img.ty-sprite${cls ? `.${cls}` : ''}`, { src: art.src(names, placeholder), alt: '', draggable: 'false', width: w, height: hgt, style: `left:${x}px;top:${y}px;z-index:${zIndex}${flip ? ';transform:scaleX(-1)' : ''}` });
    els.push(img);
    return img;
  };

  // The floor: corridor everywhere, then each room's own.
  const floorAt = new Map<string, { names: string[]; color: string }>();
  for (let gx = 0; gx < gw; gx++) for (let gy = 0; gy < gd; gy++) floorAt.set(`${gx},${gy}`, { names: ['floor-corridor', 'floor'], color: CORRIDOR });
  for (const r of rooms) for (let gx = r.x; gx < r.x + r.w; gx++) for (let gy = r.y; gy < r.y + r.d; gy++) floorAt.set(`${gx},${gy}`, { names: [`floor-${slug(r.name)}`, 'floor'], color: r.color });
  for (const [key, f] of floorAt) {
    const [gx, gy] = key.split(',').map(Number);
    const p = at(gx, gy);
    sprite(f.names, () => art.floorTile(f.color), p.x - TW / 2, p.y, '1', 'ty-floor');
    // One floor art for every room: tinted in the room's color, so the rooms still tell apart.
    if (f.color !== CORRIDOR && art.hasArt('floor') && !art.hasArt(f.names[0])) {
      sprite(['floor-tint'], () => art.floorTile(f.color), p.x - TW / 2, p.y, '2', 'ty-floor.ty-tint');
    }
  }

  // The walls along the two back edges.
  for (let gy = 0; gy < gd; gy++) {
    const p = at(0, gy);
    sprite(['wall'], art.wall, p.x - TW / 2, p.y + TH - 192, z(0, gy, 0), 'ty-wall');
  }
  for (let gx = 0; gx < gw; gx++) {
    const p = at(gx, 0);
    sprite(['wall'], art.wall, p.x - TW / 2, p.y + TH - 192, z(gx, 0, 0), 'ty-wall', true);
  }

  for (const r of rooms) {
    const g = (dx: number, dy: number) => [r.x + dx, r.y + dy] as const;
    // A shelf against the wall, where the room has one, and a plant in its back corner.
    if (r.x === 0) {
      const [sx, sy] = g(0, 1);
      sprite(['shelf'], art.shelf, at(sx, sy).x - 64, at(sx, sy).y + TH - 128, z(sx, sy, 2));
    }
    const [px, py] = g(ROOM_W - 1, 0);
    sprite(['plant'], art.plant, at(px, py).x - 64, at(px, py).y + TH - 128, z(px, py, 2));
    // Decoration, only once there's art for it: a rug under the desks, a whiteboard on the back
    // wall, and by the door a coffee machine and a water cooler (and, in the first room, a sofa).
    const decor = (name: string, gx: number, gy: number, sub = 2) => {
      if (!art.hasArt(name)) return;
      const [w, hgt] = art.size(name);
      const p = at(gx, gy);
      sprite([name], () => '', p.x - w / 2, p.y + TH - hgt, z(Math.floor(gx), Math.floor(gy), sub));
    };
    if (art.hasArt('rug')) {
      const c = at(r.x + r.w / 2, r.y + r.d / 2);
      sprite(['rug'], () => '', c.x - 128, c.y - 64, '3');
    }
    if (r.y === 0) decor('whiteboard', ...g(3, 0));
    decor('coffee-machine', ...g(0, r.d - 1));
    decor('water-cooler', ...g(ROOM_W - 1, r.d - 1));
    if (r === rooms[0]) decor('sofa', ...g(2.5, r.d - 1));

    for (let i = 0; i < desksIn(r); i++) {
      const s = seatAt(i);
      const w = r.workers[i];
      const [dx, dy] = g(...s.desk);
      const d = at(dx, dy);
      const deskImg = sprite(['desk'], art.desk, d.x - 64, d.y + TH - 128, z(dx, dy, 2), w ? 'ty-desk' : 'ty-desk.ty-free', s.left);
      if (!w) {
        deskImg.title = `Free desk in ${r.name}: hire someone`;
        deskImg.addEventListener('click', () => act.hire(r));
        continue;
      }
      deskImg.addEventListener('click', () => act.open(w.id));
      const [mx, my] = g(...s.minion);
      const m = at(mx, my);
      const pose = poseOf(w.status);
      const role = roleOf(w.prompt);
      const names = [...(role ? [`minion-${role}-${pose}`] : []), `minion-${pose}`];
      const top = m.y + TH / 2 - 92;
      const img = sprite(names, () => art.minion(w.color, pose), m.x - 32, top, z(mx, my, 1), `ty-minion.${w.status}`, s.left);
      img.title = `${w.name}: open its terminal`;
      img.addEventListener('click', () => act.open(w.id));
      els.push(tag(w, act.roleName(w.id), m.x, top));
    }

    // The room's name, along its front edge, where it covers no room behind it.
    const c = at(r.x + r.w / 2, r.y + r.d);
    els.push(
      h(
        'button.ty-sign',
        { type: 'button', title: `Hire into ${r.name}`, style: `left:${c.x - 128}px;top:${c.y - 40}px;z-index:9000;background-image:url("${art.src(['sign'], () => art.sign(r.color))}")`, onclick: () => act.hire(r) },
        r.name,
      ),
    );
  }

  world.replaceChildren(...els);
  const width = ox + gw * (TW / 2) + 16;
  const height = oy + (gw + gd) * (TH / 2) + 64;
  world.style.width = `${width}px`;
  world.style.height = `${height}px`;
  return { width, height };
}

const STATUS_ICON: Record<string, string> = { 'needs-you': 'icon-needs-you', done: 'icon-done', working: 'icon-working' };

/** The name tag over a minion's head, with what it's up to. */
function tag(w: WorkerInfo, role: string | undefined, x: number, top: number): HTMLElement {
  const pose = poseOf(w.status);
  const icon = STATUS_ICON[pose];
  return h(
    'div.ty-tag',
    { class: pose, style: `left:${x}px;top:${top - 8}px` },
    icon ? h('img.ty-icon', { src: art.src([icon], () => art.icon(icon)), alt: '', width: 28, height: 28 }) : null,
    h('span.ty-name', {}, w.name),
    role ? h('span.ty-role', {}, role) : null,
  );
}
