// What the isometric view leaves out so you can see into the rooms, whole things at a time (never
// half of one): whatever's above the room (the ceilings and their lights, the roof, the floors over
// this one), and the tall things along the two near walls, the ones between the camera and the room
// (the camera looks in from the +x, +z corner). The back walls stand at their full height, windows
// and all. Only what this hid is shown again, so others' hiding is left alone.
import * as THREE from 'three';
import { FLOOR } from '../../../shared/layout';
import type { Ctx } from '../../core/context';

/** Higher than this over the floor is above the room. */
export const ROOM_TOP = 2.4;
/** Within this of a near wall, a tall thing is in the way. */
const NEAR_WALL = 2.2;

export function isoCutaway(ctx: Ctx, floorY: () => number) {
  const hidden = new Set<THREE.Object3D>();
  const box = new THREE.Box3();
  const c = new THREE.Vector3();

  function apply() {
    for (const o of hidden) o.visible = true;
    hidden.clear();
    const y = floorY();
    ctx.office.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) return;
      box.setFromObject(mesh);
      if (box.isEmpty()) return;
      const bottom = box.min.y - y;
      const top = box.max.y - y;
      box.getCenter(c);
      const above = bottom > ROOM_TOP;
      const near = c.x > FLOOR.maxX - NEAR_WALL || c.z > FLOOR.maxZ - NEAR_WALL;
      const tall = top > ROOM_TOP + 0.4 && bottom < ROOM_TOP;
      if (above || (tall && near)) {
        mesh.visible = false;
        hidden.add(mesh);
      }
    });
  }

  return { apply };
}
