// Idle cats stretch their legs: now and then one that's idle or done gets up, walks over to the
// coffee machine, a bean bag, the TV or the bookshelf, stays a little, and walks back to its desk.
// Only how it looks here: it never leaves its desk as far as the office knows, and the moment it has
// something to do (or needs you) it's back in its seat.
import * as THREE from 'three';
import type { Ctx } from '../../core/context';
import type { Parts } from '../../core/parts';
import { store } from '../../state';

const SPEED = 1.1;
/** How long it stays where it went (s). */
const STAY = 8;
/** How often one might get up (s), and how far it'll go (m). */
const EVERY = 12;
const FAR = 14;
const SPOTS = new Set(['coffee', 'seat', 'tv', 'bookshelf', 'dog', 'jukebox']);

interface Trip {
  id: string;
  path: THREE.Vector3[];
  leg: number;
  stay: number;
}

export function isoWander(ctx: Ctx, parts: Pick<Parts, 'views'>) {
  const trips = new Map<string, Trip>();
  let next = 5;
  const at = new THREE.Vector3();

  function startOne() {
    const idle = [...store.workers.values()].filter((w) => (w.status === 'idle' || w.status === 'done') && !trips.has(w.id) && parts.views.workerViews.has(w.id));
    if (!idle.length) return;
    const w = idle[Math.floor(Math.random() * idle.length)];
    const v = parts.views.workerViews.get(w.id)!;
    const anchor = v.model.root.parent;
    if (!anchor) return;
    anchor.getWorldPosition(at);
    // On the floor, not at seat height.
    at.y = 0;
    const spots = ctx.office.interactables.filter((it) => SPOTS.has(it.kind) && !it.off && Math.hypot(it.x - at.x, it.z - at.z) < FAR);
    if (!spots.length) return;
    const s = spots[Math.floor(Math.random() * spots.length)];
    const there = new THREE.Vector3(s.x, 0, s.z);
    // Stop short of it, on the side it came from.
    const back = at.clone().sub(there).setY(0).normalize().multiplyScalar(0.9);
    there.add(back);
    trips.set(w.id, { id: w.id, path: [at.clone(), there, at.clone()], leg: 0, stay: STAY });
  }

  const local = new THREE.Vector3();
  function update(dt: number) {
    next -= dt;
    if (next <= 0) {
      next = EVERY * (0.6 + Math.random() * 0.8);
      startOne();
    }
    for (const trip of trips.values()) {
      const w = store.workers.get(trip.id);
      const v = parts.views.workerViews.get(trip.id);
      const anchor = v?.model.root.parent;
      if (!w || !v || !anchor) {
        trips.delete(trip.id);
        continue;
      }
      const root = v.model.root;
      // Back to work: straight into its seat.
      const busy = w.status !== 'idle' && w.status !== 'done';
      if (busy || trip.leg >= 2) {
        root.position.set(0, 0, 0);
        root.rotation.set(0, 0, 0);
        v.model.walking = false;
        trips.delete(trip.id);
        continue;
      }
      if (trip.leg === 1 && trip.stay > 0 && root.userData.arrived) {
        trip.stay -= dt;
        v.model.walking = false;
        if (trip.stay <= 0) root.userData.arrived = false;
        continue;
      }
      // Walking in its seat's own space, where (0, 0, 0) is its chair.
      const to = anchor.worldToLocal(local.copy(trip.path[trip.leg + 1]));
      const step = (SPEED * dt) / anchor.getWorldScale(at).x;
      const d = Math.hypot(to.x - root.position.x, to.z - root.position.z);
      v.model.walking = true;
      if (d <= step) {
        root.position.set(to.x, to.y, to.z);
        if (trip.leg === 0) root.userData.arrived = true;
        trip.leg++;
      } else {
        const dx = (to.x - root.position.x) / d;
        const dz = (to.z - root.position.z) / d;
        root.position.x += dx * step;
        root.position.z += dz * step;
        // Down off the chair onto the floor as it sets off.
        root.position.y = to.y;
        root.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  return { update };
}
