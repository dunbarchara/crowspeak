import { Vector3, type Camera } from 'three';
import type { SurfaceState } from '../lib/surface';
import type { HeightFn } from '../lib/terrain';

export type FollowCameraOptions = {
  distance: number; // behind the character
  height: number; // above the character, along local up
  lookHeight: number; // aim this far above the character's feet
  posK: number; // position smoothing, higher = tighter
  upK: number; // horizon roll smoothing, higher = tighter
  clearance: number; // minimum height above the terrain
};

// scratch objects, reused every call to avoid per-frame allocation
const up = new Vector3();
const dir = new Vector3();
const camTarget = new Vector3();
const lookTarget = new Vector3();

// Moves the camera behind and above the character and rolls its up vector to
// match the local surface normal. Call it after the character has moved this
// frame, in the same useFrame, so the camera never lags a frame behind.
export function followCamera(
  camera: Camera,
  state: SurfaceState,
  heightFn: HeightFn,
  dt: number,
  opts: FollowCameraOptions,
) {
  // where the camera wants to be: behind and above, in the character's frame
  up.copy(state.pos).normalize();
  camTarget
    .copy(state.pos)
    .addScaledVector(up, opts.height)
    .addScaledVector(state.heading, -opts.distance);

  // ease toward it
  camera.position.lerp(camTarget, 1 - Math.exp(-opts.posK * dt));

  // keep the camera out of the hills (uses the same heightFn)
  dir.copy(camera.position).normalize();
  const minR = heightFn(dir.x, dir.y, dir.z) + opts.clearance;
  if (camera.position.length() < minR)
    camera.position.copy(dir).multiplyScalar(minR);

  // roll the camera's up toward the character's up, then aim
  camera.up.lerp(up, 1 - Math.exp(-opts.upK * dt)).normalize();
  lookTarget.copy(state.pos).addScaledVector(up, opts.lookHeight);
  camera.lookAt(lookTarget);
}
