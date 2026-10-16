// Using things in the isometric view: what's under the mouse lights the cursor up and says what it
// is, and a click uses it, as E does at it in the walk-around office (see ctx.interactions), with a
// little pop of what happened (a coffee, a note, a bark) rising off it. Only what works from up
// here: nothing that takes the controls or the camera (the arcade, golf, a car, the telescope). The
// floor's own props and the office's plants react too: a toast, a pop and a bounce, spin or grow.
import * as THREE from 'three';
import type { Ctx } from '../../core/context';
import { store } from '../../state';
import type { Interactable } from '../../world/types';
import { toast } from '../../ui/dom';
import type { Move, React } from './props';

/** What a click does to each kind, and the pop it gives off. */
const USABLE: Partial<Record<Interactable['kind'], string>> = {
  coffee: '☕',
  jukebox: '🎧',
  gong: '🔔',
  whiteboard: '🖍️',
  bookshelf: '📚',
  issues: '📌',
  pulls: '🔀',
  queue: '📋',
  services: '🛠️',
  tv: '📺',
  dog: '🐶',
  elevator: '🛗',
  meeting: '🗣️',
  decor: '🖼️',
  herald: '📜',
  station: '💬',
};

export interface PickDeps {
  /** A worker (or its desk) was clicked. */
  openWorker(id: string): void;
  /** A free desk was clicked. */
  hireAt(deskId: string): void;
  /** The jukebox was clicked: the focus music. */
  music(): void;
  /** What else can be clicked: the floor's own props (see theme.ts). */
  extra(): THREE.Object3D[];
}

/** The office's potted plants (see plant() in world/office/props.ts): watered when clicked. */
const PLANT = /^(monstera|snake_plant|ficus|succulent)/;
const WATERED: React = { emoji: '💧', label: 'Plant: water it', says: ['Watered! It perks up', 'Glug glug… happy plant', 'It grew a little!'], move: 'grow' };

type Under = { point: THREE.Vector3; it?: Interactable; react?: React; obj?: THREE.Object3D };

export function isoPicking(ctx: Ctx, canvas: HTMLCanvasElement, cutY: () => number, deps: PickDeps) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tip = document.createElement('div');
  tip.className = 'iso-tip hidden';
  document.body.append(tip);

  /** What's under the mouse: the first thing that does something, past anything left out of the view. */
  function under(e: { clientX: number; clientY: number }): Under | null {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, ctx.camera);
    for (const hit of raycaster.intersectObjects([ctx.office.group, ...ctx.usables.pickables(), ...deps.extra()], true)) {
      if (hit.point.y > cutY()) continue;
      let it: Interactable | undefined;
      let react: React | undefined;
      let obj: THREE.Object3D | undefined;
      let shown = true;
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        if (!o.visible) shown = false;
        it ??= o.userData.interact as Interactable | undefined;
        if (!react && o.userData.react) {
          react = o.userData.react as React;
          obj = o;
        } else if (!react && PLANT.test(o.name)) {
          react = WATERED;
          obj = o.parent ?? o;
        }
      }
      if (!shown) continue;
      if (it && !it.off && (it.kind === 'desk' || USABLE[it.kind])) return { it, point: hit.point };
      if (react) return { react, obj, point: hit.point };
      // The floor, a wall: nothing past it.
      return null;
    }
    return null;
  }

  /** What a click would do, in a few words, or null when it does nothing from here. */
  function label(u: Under): string | null {
    if (u.react) return `${u.react.emoji} ${u.react.label}`;
    const it = u.it!;
    if (it.kind === 'desk' && it.deskId) {
      const w = store.workerAtDesk(it.deskId);
      return w ? `🐱 ${w.name}` : '🪑 Free desk: hire someone';
    }
    const pop = USABLE[it.kind];
    return pop ? `${pop} ${it.label ?? it.kind}` : null;
  }

  function hover(e: PointerEvent) {
    const u = under(e);
    const text = u && label(u);
    canvas.style.cursor = text ? 'pointer' : 'grab';
    tip.classList.toggle('hidden', !text);
    if (text) {
      tip.textContent = text;
      tip.style.left = `${e.clientX + 14}px`;
      tip.style.top = `${e.clientY + 14}px`;
    }
  }

  function click(e: PointerEvent) {
    const u = under(e);
    if (!u) return;
    if (u.react && u.obj) {
      const says = u.react.says[Math.floor(Math.random() * u.react.says.length)];
      toast(`${u.react.emoji} ${says}`);
      puff(u.react.emoji, u.point);
      animate(u.obj, u.react.move);
      return;
    }
    const it = u.it!;
    if (it.kind === 'desk' && it.deskId) {
      const w = store.workerAtDesk(it.deskId);
      if (w) deps.openWorker(w.id);
      else deps.hireAt(it.deskId);
      return;
    }
    const pop = USABLE[it.kind];
    if (!pop) return;
    if (it.kind === 'jukebox') deps.music();
    else ctx.interactions.use(it, 'E', null);
    puff(pop, u.point);
  }

  // ---- How a clicked thing moves ------------------------------------------------------------------
  const moving = new Map<THREE.Object3D, { move: Move; t: number; scale: THREE.Vector3; rotY: number }>();
  function animate(obj: THREE.Object3D, move: Move) {
    const was = moving.get(obj);
    const scale = was?.scale ?? obj.scale.clone();
    // A plant that's watered stays a little bigger (up to half as big again).
    if (move === 'grow' && scale.x < 1.5) scale.multiplyScalar(1.06);
    moving.set(obj, { move, t: 0, scale, rotY: was?.rotY ?? obj.rotation.y });
  }
  function animateTick(dt: number) {
    for (const [obj, m] of moving) {
      m.t += dt;
      const k = Math.min(1, m.t / 0.9);
      const wave = Math.sin(k * Math.PI);
      obj.scale.copy(m.scale);
      obj.rotation.y = m.rotY;
      if (m.move === 'bounce') obj.scale.y = m.scale.y * (1 + 0.25 * wave);
      else if (m.move === 'grow') obj.scale.multiplyScalar(1 + 0.15 * wave);
      else if (m.move === 'wobble') obj.rotation.y = m.rotY + 0.35 * Math.sin(k * Math.PI * 4) * (1 - k);
      else if (m.move === 'spin') obj.rotation.y = m.rotY + k * Math.PI * 2;
      else if (m.move === 'glow') obj.scale.multiplyScalar(1 + 0.08 * Math.sin(k * Math.PI * 6) * (1 - k));
      if (k >= 1) {
        obj.scale.copy(m.scale);
        obj.rotation.y = m.rotY;
        moving.delete(obj);
      }
    }
  }

  // ---- The pops: an emoji rising off what you used, and fading ----------------------------------------
  const pops: { sprite: THREE.Sprite; t: number }[] = [];
  const textures = new Map<string, THREE.Texture>();
  function texture(emoji: string): THREE.Texture {
    let t = textures.get(emoji);
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.font = '192px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 128, 140);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    textures.set(emoji, t);
    return t;
  }
  function puff(emoji: string, at: THREE.Vector3) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(emoji), transparent: true, depthTest: false }));
    sprite.position.copy(at).y += 0.6;
    sprite.scale.setScalar(0.7);
    sprite.renderOrder = 999;
    ctx.scene.add(sprite);
    pops.push({ sprite, t: 0 });
  }
  function update(dt: number) {
    animateTick(dt);
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += dt;
      p.sprite.position.y += dt * 0.9;
      const k = p.t / 1.6;
      p.sprite.scale.setScalar(0.7 + Math.min(k, 0.3));
      (p.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k * k);
      if (k >= 1) {
        ctx.scene.remove(p.sprite);
        p.sprite.material.dispose();
        pops.splice(i, 1);
      }
    }
  }

  return { hover, click, update, puff, hideTip: () => tip.classList.add('hidden') };
}
