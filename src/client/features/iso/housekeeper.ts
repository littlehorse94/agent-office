// The housekeeper: a cat in a cap who walks the floor you're on, round its pods and back, keeping an
// eye on things. Click it and it says how the building is doing. It's the office's own, not a
// worker: nothing it does reaches the server.
import * as THREE from 'three';
import type { Ctx } from '../../core/context';
import { store } from '../../state';
import { Worker } from '../../world/character';
import { catify } from '../../world/character/worker-cat';
import { mesh, toon } from '../../world/toon';
import type { Pod } from './rooms';
import type { React } from './props';

/** How fast it walks (m/s). */
const SPEED = 0.9;

export function isoHousekeeper(ctx: Ctx, pods: () => Pod[]) {
  const cat = new Worker('Housekeeper', '#5c677d');
  catify(cat, { fur: '#ffd166', vest: '#1d3557', wear: 'badge', wearColor: '#e9c46a' });
  // A cap, so you know who's in charge.
  const body = cat.root.children[0];
  const cap = mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 18), toon('#1d3557'), 0, 0.97, 0);
  const brim = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 18, 1, false, 0, Math.PI), toon('#1d3557'), 0, 0.93, 0.12);
  brim.scale.z = 0.8;
  body.add(cap, brim);
  cat.setStatus('idle', false);
  cat.walking = true;
  ctx.scene.add(cat.root);

  const react: React = { emoji: '🧹', label: 'Housekeeper', says: [], move: 'bounce' };
  cat.root.userData.react = react;

  let path: THREE.Vector3[] = [];
  let leg = 0;
  let floorKey = '';

  /** Its round: along the corridors between the pods, and round them. */
  function plan(ps: Pod[]) {
    const xs = ps.map((p) => p.center.x);
    const zs = ps.map((p) => p.center.z);
    const y = ps[0].center.y;
    const [x0, x1] = [Math.min(...xs) - 2.6, Math.max(...xs) + 2.6];
    const [z0, z1] = [Math.min(...zs) - 2.6, Math.max(...zs) + 2.6];
    const zm = (z0 + z1) / 2;
    path = [
      [x0, zm], [x1, zm], [x1, z1], [x0, z1], [x0, zm], [x0, z0], [x1, z0], [x1, zm],
    ].map(([x, z]) => new THREE.Vector3(x, y, z));
    leg = 0;
    cat.root.position.copy(path[0]);
  }

  function says(): string[] {
    const ws = [...store.workers.values()];
    const need = ws.filter((w) => w.status === 'needs_input').length;
    const busy = ws.filter((w) => w.status === 'working').length;
    return [
      need ? `🧹 ${need} minion${need === 1 ? '' : 's'} need you on this floor!` : '🧹 All quiet on this floor.',
      `🧹 ${busy} working, ${ws.length} hired here. I'm keeping an eye on them.`,
      '🧹 Floors swept, plants watered, lights on.',
    ];
  }

  const to = new THREE.Vector3();
  function update(dt: number, t: number) {
    const ps = pods();
    const key = `${store.floor}|${ps.length}`;
    if (key !== floorKey && ps.length) {
      floorKey = key;
      plan(ps);
    }
    if (path.length < 2) return;
    react.says = says();
    to.copy(path[(leg + 1) % path.length]);
    const step = SPEED * dt;
    const d = cat.root.position.distanceTo(to);
    if (d <= step) {
      cat.root.position.copy(to);
      leg = (leg + 1) % path.length;
    } else {
      to.sub(cat.root.position).normalize();
      cat.root.position.addScaledVector(to, step);
      cat.root.rotation.y = Math.atan2(to.x, to.z);
    }
    cat.update(dt, t);
  }

  return { update, root: cat.root };
}
