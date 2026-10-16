// The rooms of the isometric office: the floor's desks fall into pods (the clusters they stand in),
// each division of the roles gets a pod of its own, in order, and its name floats over it. A minion
// hired into a role is seated in its division's pod while there's a free desk there.
import * as THREE from 'three';
import type { Ctx } from '../../core/context';
import { deskBuilt } from '../../../shared/layout';
import { store } from '../../state';
import type { TycoonRole } from '../../../shared/tycoon';
import type { DeskView } from '../../world/types';

export interface Pod {
  desks: DeskView[];
  center: THREE.Vector3;
}

/** Desks closer than this (m) are in the same pod. */
const NEAR = 2.6;

/** The floor's pods, left to right and back to front. */
export function podsOf(ctx: Ctx): Pod[] {
  // Desks only (not the bean bags), and only what's built: the back office's wait behind its wall.
  const desks = [...ctx.world().desks.values()].filter((d) => d.def.id.startsWith('desk-') && !d.def.station && !d.def.room && deskBuilt(d.def, store.floorPlan.wing ?? 0));
  const at = new Map(desks.map((d) => [d, d.group.getWorldPosition(new THREE.Vector3())]));
  const pods: DeskView[][] = [];
  for (const d of desks) {
    const near = pods.filter((p) => p.some((o) => at.get(o)!.distanceTo(at.get(d)!) < NEAR));
    const merged = near.flat();
    for (const p of near) pods.splice(pods.indexOf(p), 1);
    pods.push([...merged, d]);
  }
  return pods
    .map((ds) => {
      const center = new THREE.Vector3();
      for (const d of ds) center.add(at.get(d)!);
      return { desks: ds, center: center.divideScalar(ds.length) };
    })
    .sort((a, b) => a.center.z - b.center.z || a.center.x - b.center.x);
}

export function isoRooms(ctx: Ctx, roles: () => readonly TycoonRole[]) {
  let pods: Pod[] = [];
  let divisions: string[] = [];
  const labels = new THREE.Group();
  ctx.scene.add(labels);
  let key = '';

  /** Which pod each division has, by name. */
  const podOf = (division: string) => pods[divisions.indexOf(division)];

  function refresh() {
    pods = podsOf(ctx);
    divisions = [...new Set(roles().map((r) => r.division))];
    const k = `${store.floor}|${pods.length}|${divisions.join(',')}`;
    if (k === key) return;
    key = k;
    for (const s of labels.children.splice(0)) ((s as THREE.Sprite).material as THREE.SpriteMaterial).map?.dispose();
    divisions.forEach((name, i) => {
      const pod = pods[i];
      if (!pod) return;
      const s = sign(name);
      s.position.set(pod.center.x, pod.center.y + 1.9, pod.center.z);
      labels.add(s);
    });
  }

  /** A free desk in `role`'s division's pod, if it has one with room. */
  function deskFor(role: TycoonRole | undefined): string | undefined {
    if (!role) return undefined;
    refresh();
    return podOf(role.division)?.desks.find((d) => !store.workerAtDesk(d.def.id))?.def.id;
  }

  return { refresh, deskFor, pods: () => pods, labels };
}

/** A room's name, as a rounded sign that always faces you. */
function sign(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = '800 44px Nunito, "Segoe UI", system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 64;
  c.width = w;
  c.height = 84;
  g.font = font;
  g.fillStyle = '#fff8ec';
  g.strokeStyle = '#2b2d42';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(4, 4, w - 8, 76, 30);
  g.fill();
  g.stroke();
  g.fillStyle = '#2b2d42';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 45);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set((w / 84) * 0.55, 0.55, 1);
  s.renderOrder = 998;
  return s;
}
