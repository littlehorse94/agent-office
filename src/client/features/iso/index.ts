// The isometric view (/iso): the office seen from above at a fixed tycoon-game angle instead of
// through your own eyes. The camera is taken over each frame (after you've moved, before the frame is
// drawn), everything above the walls' cut line is clipped away so you look down into the rooms, your
// own character is hidden, and the mouse drags the view, wheels the zoom and clicks a worker's desk.
import * as THREE from 'three';
import type { Ctx } from '../../core/context';
import type { Parts } from '../../core/parts';
import { store } from '../../state';
import type { Interactable } from '../../world/types';

/** Whether this page is the isometric view. */
export const isIso = () => location.pathname === '/iso' || new URLSearchParams(location.search).has('iso');

/** The tycoon angle: 45° round, looking down 32°. */
const YAW = Math.PI / 4;
const PITCH = THREE.MathUtils.degToRad(32);
/** A long lens from far off, so it's all but flat (isometric), as a tycoon game draws it. */
const DISTANCE = 140;
const FOV_MIN = 2.2;
const FOV_MAX = 16;
/** How high the walls are cut, above the floor you're on. */
const CUT = 2.3;

export interface IsoDeps {
  /** A worker's desk was clicked. */
  openWorker(id: string): void;
}

export function installIso(ctx: Ctx, parts: Pick<Parts, 'stage' | 'me' | 'player'>, deps: IsoDeps) {
  if (!isIso()) return;
  document.body.classList.add('iso');
  const { camera, renderer, canvas } = ctx;
  parts.player.setView('third');

  let fov = 9;
  const focus = new THREE.Vector3(0, 0, 0);
  const cut = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT);
  // And below the floor: the street far beneath the building, the garage, the scenic loop.
  const below = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  renderer.clippingPlanes = [cut, below];
  /** What's round the office, instead of the sky: a plain backdrop, as a tycoon game has. */
  const backdrop = new THREE.Color('#dfeee4');
  const dir = new THREE.Vector3(Math.cos(PITCH) * Math.sin(YAW), Math.sin(PITCH), Math.cos(PITCH) * Math.cos(YAW));

  /** The meshes the clouds are made of (the sky shows and hides their material, which the outline ignores). */
  let clouds: THREE.Object3D[] | null = null;
  const cloudMeshes = () => {
    if (clouds) return clouds;
    const found: THREE.Object3D[] = [];
    ctx.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).material === ctx.office.night.clouds) found.push(o);
    });
    return (clouds = found);
  };

  /** The sky's dome and the weather's particles, as the scene has them (found once). */
  let sky: THREE.Object3D[] | null = null;
  const skyBits = () =>
    (sky ??= ctx.scene.children.filter((c) => {
      if (c === ctx.office.group) return false;
      let dome = false;
      let onlyParticles = true;
      let any = false;
      c.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && !Array.isArray(m) && m.type === 'ShaderMaterial' && m.side === THREE.BackSide) dome = true;
        if ((o as THREE.Mesh).isMesh || (o as THREE.Sprite).isSprite) onlyParticles = false;
        if ((o as THREE.Points).isPoints || (o as THREE.LineSegments).isLineSegments) any = true;
      });
      return dome || (any && onlyParticles);
    }));

  /**
   * The toon outline is drawn by a material of its own that the cut doesn't reach: anything that
   * reaches above the cut (walls, the roof, the ceilings) or below the floor would leave its outline
   * hanging in the air. Those go without one here. The outline keeps its materials from frame to
   * frame, so after changing any, the office is left out of one frame for them to be made again.
   */
  const box = new THREE.Box3();
  const unlined = new WeakSet<THREE.Material>();
  let skipFrame = false;
  let restore = false;
  function unlineCut() {
    const floorY = parts.player.pos.y;
    let changed = false;
    ctx.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      box.setFromObject(mesh);
      if (box.max.y <= floorY + CUT && box.min.y >= floorY - 0.3) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (unlined.has(m)) continue;
        unlined.add(m);
        m.userData.outlineParameters = { ...(m.userData.outlineParameters ?? {}), visible: false };
        changed = true;
      }
    });
    if (changed) skipFrame = true;
  }
  unlineCut();
  setInterval(unlineCut, 3000);

  // Always a bright afternoon here, whatever the hour: a tycoon office is never in the dark.
  const daylight = () => ctx.sky.show({ hour: 14, weather: 'clear' });
  daylight();
  setInterval(daylight, 2000);

  // After you've moved and everything's been updated, just before the frame is drawn.
  ctx.ticks.add('hud', () => {
    const floorY = parts.player.pos.y;
    focus.y = floorY;
    cut.constant = floorY + CUT;
    below.constant = -(floorY - 0.3);
    // The sky keeps its own colour object and sets it every frame: this colours it after.
    if (ctx.scene.background instanceof THREE.Color) ctx.scene.background.copy(backdrop);
    else ctx.scene.background = backdrop.clone();
    camera.position.copy(focus).addScaledVector(dir, DISTANCE);
    camera.up.set(0, 1, 0);
    camera.lookAt(focus);
    if (camera.fov !== fov || camera.far < DISTANCE * 2) {
      camera.fov = fov;
      camera.far = DISTANCE * 3;
      camera.updateProjectionMatrix();
    }
    // No haze between you and the office from up here.
    const fog = ctx.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = DISTANCE + 60;
      fog.far = DISTANCE + 200;
    }
    parts.me.root.visible = false;
    if (skipFrame) {
      ctx.office.group.visible = false;
      skipFrame = false;
      restore = true;
    } else if (restore) {
      ctx.office.group.visible = true;
      restore = false;
    }
    // No sky from up here: its clouds would hang over the rooms, and its dome and stars, round them.
    for (const o of cloudMeshes()) o.visible = false;
    for (const o of skyBits()) o.visible = false;
    // The roof and the ceilings are cut away, but they'd still shade the floor from the sun.
    parts.stage.sun.castShadow = false;
    // Full daylight, as the office is lit at noon (see createScene), whatever the sky is doing.
    const { hemi, ambient, sun } = parts.stage;
    hemi.intensity = 1.25;
    ambient.intensity = 0.45;
    sun.intensity = 1.7;
    hemi.color.set('#fff5e6');
    sun.color.set('#fff1d6');
  });

  // ---- The mouse: drag to look round, wheel to zoom, click a desk --------------------------------------
  let drag: { x: number; y: number; moved: boolean } | null = null;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      drag = { x: e.clientX, y: e.clientY, moved: false };
      e.stopImmediatePropagation();
    },
    true,
  );
  // The office's own clicks (using what's under the mouse, walking there) are the 3D view's, not this one's.
  for (const type of ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'] as const) canvas.addEventListener(type, (e) => e.stopImmediatePropagation(), true);
  window.addEventListener('pointermove', (e) => {
    if (!drag || !(e.buttons & 1)) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    // Metres per pixel at the focus.
    const m = (2 * DISTANCE * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) / canvas.clientHeight;
    // Screen right and screen up, flattened onto the floor.
    const right = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
    const up = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW));
    focus.addScaledVector(right, -dx * m).addScaledVector(up, (dy * m) / Math.sin(PITCH));
  });
  window.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (d && !d.moved && e.target === canvas) click(e);
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      fov = THREE.MathUtils.clamp(fov * (e.deltaY > 0 ? 1.12 : 1 / 1.12), FOV_MIN, FOV_MAX);
    },
    { passive: false, capture: true },
  );

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  // Debug handle: what's under a point on the screen (for tuning what's cut away).
  (window as any).__iso = {
    pick(x: number, y: number) {
      const r = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1), camera);
      return raycaster
        .intersectObjects(ctx.scene.children, true)
        .filter((h) => h.point.y <= cut.constant)
        .slice(0, 3)
        .map((h) => {
          const names: string[] = [];
          for (let o: THREE.Object3D | null = h.object; o; o = o.parent) if (o.name) names.push(o.name);
          return { y: +h.point.y.toFixed(2), names: names.slice(0, 4), type: h.object.type, color: ((h.object as THREE.Mesh).material as THREE.MeshToonMaterial)?.color?.getHexString?.() };
        });
    },
    focus,
  };
  function click(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    for (const hit of raycaster.intersectObjects([ctx.office.group, ...ctx.usables.pickables()], true)) {
      if (hit.point.y > cut.constant) continue;
      let it: Interactable | undefined;
      for (let o: THREE.Object3D | null = hit.object; o && !it; o = o.parent) it = o.userData.interact as Interactable | undefined;
      const w = it?.deskId ? store.workerAtDesk(it.deskId) : undefined;
      if (w) return deps.openWorker(w.id);
      if (it) return;
    }
  }
}
