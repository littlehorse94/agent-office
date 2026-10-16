// Using things in the isometric view: what's under the mouse lights the cursor up and says what it
// is, and a click uses it, as E does at it in the walk-around office (see ctx.interactions), with a
// little pop of what happened (a coffee, a note, a bark) rising off it. Only what works from up
// here: nothing that takes the controls or the camera (the arcade, golf, a car, the telescope).
import * as THREE from 'three';
import type { Ctx } from '../../core/context';
import { store } from '../../state';
import type { Interactable } from '../../world/types';

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
}

export function isoPicking(ctx: Ctx, canvas: HTMLCanvasElement, cutY: () => number, deps: PickDeps) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tip = document.createElement('div');
  tip.className = 'iso-tip hidden';
  document.body.append(tip);

  /** What's under the mouse: the first thing you could use, past anything cut away. */
  function under(e: { clientX: number; clientY: number }): { it: Interactable; point: THREE.Vector3 } | null {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, ctx.camera);
    for (const hit of raycaster.intersectObjects([ctx.office.group, ...ctx.usables.pickables()], true)) {
      if (hit.point.y > cutY()) continue;
      let it: Interactable | undefined;
      let shown = true;
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        if (!o.visible) shown = false;
        it ??= o.userData.interact as Interactable | undefined;
      }
      if (!shown) continue;
      if (it && !it.off) return { it, point: hit.point };
      // The floor, a wall: nothing past it.
      if (hit.object.userData.solid !== false) return null;
    }
    return null;
  }

  /** What a click on `it` would do, in a few words, or null when it does nothing from here. */
  function label(it: Interactable): string | null {
    if (it.kind === 'desk' && it.deskId) {
      const w = store.workerAtDesk(it.deskId);
      return w ? `🐱 ${w.name}` : '🪑 Free desk: hire someone';
    }
    const pop = USABLE[it.kind];
    return pop ? `${pop} ${it.label ?? it.kind}` : null;
  }

  function hover(e: PointerEvent) {
    const u = under(e);
    const text = u && label(u.it);
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
    const { it, point } = u;
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
    puff(pop, point);
  }

  // ---- The pops: an emoji rising off what you used, and fading ----------------------------------------
  const pops: { sprite: THREE.Sprite; t: number }[] = [];
  const textures = new Map<string, THREE.Texture>();
  function texture(emoji: string): THREE.Texture {
    let t = textures.get(emoji);
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.font = '96px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 64, 70);
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
