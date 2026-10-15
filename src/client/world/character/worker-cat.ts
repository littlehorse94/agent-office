// Workers as cats: ears, a muzzle with a pink nose and whiskers, and a tail on the little Claude
// worker, its fur in its role's colours and something its role wears (a tie, glasses, a beret, a hood,
// a badge). The worker is built in worker.ts: this only adds to its body and recolours its skin, so
// every pose, hop and dance it has still works.
import * as THREE from 'three';
import { roleOf } from '../../../shared/tycoon';
import { mesh, toon, toonUnique } from '../toon';
import type { Worker } from './worker';

type Wear = 'tie' | 'glasses' | 'beret' | 'hood' | 'badge' | 'none';

export interface CatLook {
  fur: string;
  /** Ears, tail tip and muzzle patch, where they're another colour (a Siamese's points). */
  points?: string;
  /** Patches on the body (a calico's). */
  patches?: string[];
  /** The vest it wears, and what goes with it. */
  vest?: string;
  wear: Wear;
  wearColor?: string;
}

/** Each role's cat (see the roles in macatting-hq/roles), and the office cat for anyone else. */
const LOOKS: Record<string, CatLook> = {
  'chief-of-staff': { fur: '#8d99ae', vest: '#2b2d42', wear: 'tie', wearColor: '#3d405b' },
  'marketing-strategist': { fur: '#f4a259', vest: '#e9c46a', wear: 'glasses', wearColor: '#2b2d42' },
  copywriter: { fur: '#fff3e2', patches: ['#e76f51', '#2b2d42'], vest: '#3a5a40', wear: 'beret', wearColor: '#9b2226' },
  'web-developer': { fur: '#2b2d42', vest: '#2d6a4f', wear: 'hood', wearColor: '#2d6a4f' },
  'systems-developer': { fur: '#f1e3c8', points: '#5c4033', vest: '#1d3557', wear: 'badge', wearColor: '#ffffff' },
  librarian: { fur: '#f6e7cf', vest: '#606c38', wear: 'glasses', wearColor: '#7f5539' },
  planner: { fur: '#2b2d42', points: '#ffffff', vest: '#a8dadc', wear: 'none' },
};
const OFFICE_CAT: CatLook = { fur: '#a39486', vest: '#457b9d', wear: 'none' };

/** The cat a worker hired into `prompt`'s role is. */
export function catLookFor(prompt: string | undefined): CatLook {
  return LOOKS[roleOf(prompt) ?? ''] ?? OFFICE_CAT;
}

const PINK = '#f4a6b7';

/** Makes `worker` a cat (once). */
export function catify(worker: Worker, look: CatLook) {
  const body = worker.root.children[0] as THREE.Group | undefined;
  if (!body || body.userData.cat) return;
  body.userData.cat = true;
  // Cats don't dress up for the holidays.
  worker.setCostume(null);

  // Its skin is its fur, and the headset goes (the ears are where it sat).
  const bean = body.children.find((o) => (o as THREE.Mesh).geometry instanceof THREE.CapsuleGeometry) as THREE.Mesh | undefined;
  (bean?.material as THREE.MeshToonMaterial | undefined)?.color.set(look.fur);
  for (const o of body.children) {
    const m = o as THREE.Mesh;
    const headset = (m.geometry instanceof THREE.TorusGeometry && Math.abs(m.position.y - 0.72) < 0.01) || (m.geometry instanceof THREE.SphereGeometry && Math.abs(Math.abs(m.position.x) - 0.29) < 0.01 && Math.abs(m.position.y - 0.72) < 0.01);
    if (headset) m.visible = false;
  }

  const fur = toonUnique(look.fur);
  const points = look.points ? toon(look.points) : fur;
  const pink = toon(PINK);
  const white = toon('#ffffff');
  const ink = toon('#2b2d42');

  // Ears: a pyramid each, pink inside.
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.095, 0.17, 4), points, sx * 0.15, 0.93, 0.0);
    ear.rotation.set(0, Math.PI / 4, sx * -0.38);
    body.add(ear);
    const inner = mesh(new THREE.ConeGeometry(0.055, 0.1, 3), pink, sx * 0.15, 0.92, 0.05, false);
    inner.rotation.set(0.15, 0, sx * -0.38);
    body.add(inner);
  }

  // A muzzle under its eyes, a pink nose and whiskers.
  const muzzle = mesh(new THREE.SphereGeometry(0.1, 14, 10), look.points ? points : white, 0, 0.6, 0.22, false);
  muzzle.scale.set(1.25, 0.75, 0.7);
  body.add(muzzle);
  const nose = mesh(new THREE.SphereGeometry(0.03, 10, 8), pink, 0, 0.63, 0.29, false);
  nose.scale.set(1.3, 0.8, 0.8);
  body.add(nose);
  for (const sx of [-1, 1])
    for (const tilt of [-0.18, 0, 0.18]) {
      const w = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), ink, sx * 0.17, 0.6 + tilt * 0.12, 0.25, false);
      w.rotation.z = Math.PI / 2 + sx * tilt;
      body.add(w);
    }

  // A tail, curling up behind it.
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.38, -0.24), new THREE.Vector3(0, 0.3, -0.42), new THREE.Vector3(0, 0.5, -0.55), new THREE.Vector3(0.04, 0.78, -0.52)]);
  body.add(mesh(new THREE.TubeGeometry(curve, 20, 0.04, 8, false), points));

  // A calico's patches.
  for (const [i, c] of (look.patches ?? []).entries()) {
    const p = mesh(new THREE.SphereGeometry(0.11, 12, 10), toon(c), (i ? -1 : 1) * 0.16, 0.82 - i * 0.05, -0.12);
    p.scale.set(0.9, 0.7, 0.9);
    body.add(p);
  }

  // Its vest, and what its role wears.
  if (look.vest) {
    const vest = mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.24, 20, 1, true), toon(look.vest), 0, 0.44, 0);
    (vest.material as THREE.Material).side = THREE.DoubleSide;
    body.add(vest);
  }
  const c = toon(look.wearColor ?? '#2b2d42');
  if (look.wear === 'tie') {
    const knot = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), c, 0, 0.54, 0.28);
    const tie = mesh(new THREE.ConeGeometry(0.045, 0.2, 4), c, 0, 0.42, 0.29);
    tie.rotation.set(Math.PI, Math.PI / 4, 0);
    body.add(knot, tie);
  } else if (look.wear === 'glasses') {
    for (const sx of [-1, 1]) {
      const ring = mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 18), c, sx * 0.11, 0.7, 0.3, false);
      body.add(ring);
    }
    body.add(mesh(new THREE.BoxGeometry(0.07, 0.015, 0.015), c, 0, 0.71, 0.31, false));
  } else if (look.wear === 'beret') {
    const beret = mesh(new THREE.SphereGeometry(0.2, 16, 10), c, -0.04, 0.95, -0.02);
    beret.scale.set(1.1, 0.35, 1.1);
    beret.rotation.z = 0.25;
    body.add(beret);
  } else if (look.wear === 'hood') {
    const hood = mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 20, Math.PI * 1.2), c, 0, 0.66, -0.1);
    hood.rotation.set(-0.5, 0, Math.PI * -0.1);
    body.add(hood);
  } else if (look.wear === 'badge') {
    body.add(mesh(new THREE.BoxGeometry(0.08, 0.1, 0.015), c, 0.1, 0.45, 0.29));
  }
}
