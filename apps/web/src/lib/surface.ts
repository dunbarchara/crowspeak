import { Matrix4, Quaternion, Vector3 } from 'three';
import type { HeightFn } from './terrain';

export type SurfaceState = {
  pos: Vector3; // on the terrain surface
  heading: Vector3; // unit vector, tangent to the surface at pos
  speed: number;
};

// what drives the movement: keyboard, NPC wander logic, engine intent, ...
export type MoveInput = {
  turn: number; // -1..1, positive turns left
  move: number; // -1..1, positive moves forward
};

export type SurfaceOptions = {
  turnSpeed: number; // rad/s
  maxSpeed: number; // units/s
  accel: number; // speed easing, higher = snappier
};

// scratch objects, reused every call to avoid per-frame allocation
const up = new Vector3();
const dir = new Vector3();
const right = new Vector3();
const basis = new Matrix4();

// Advances state by dt seconds. Mutates state in place.
export function stepOnSurface(
  state: SurfaceState,
  input: MoveInput,
  dt: number,
  heightFn: HeightFn,
  opts: SurfaceOptions,
) {
  // up = the direction pointing away from the planet center at our position
  up.copy(state.pos).normalize();

  // turning: rotate the heading around up
  state.heading.applyAxisAngle(up, input.turn * opts.turnSpeed * dt);

  // keep the heading tangent to the surface
  state.heading.addScaledVector(up, -state.heading.dot(up)).normalize();

  // speed eases toward the target
  state.speed +=
    (input.move * opts.maxSpeed - state.speed) *
    (1 - Math.exp(-opts.accel * dt));

  // move along the heading, then snap onto the terrain
  state.pos.addScaledVector(state.heading, state.speed * dt);
  dir.copy(state.pos).normalize();
  state.pos.copy(dir).multiplyScalar(heightFn(dir.x, dir.y, dir.z));

  // re-tangent the heading at the NEW position
  state.heading.addScaledVector(dir, -state.heading.dot(dir)).normalize();
}

// Writes the rotation that stands the character on the surface, facing
// state.heading, into out. Built from a basis (right, up, heading) rather than
// Euler angles or a fixed world-up, so it has no singularity at the poles.
export function orientationOnSurface(state: SurfaceState, out: Quaternion) {
  up.copy(state.pos).normalize();
  right.crossVectors(up, state.heading);
  basis.makeBasis(right, up, state.heading);
  out.setFromRotationMatrix(basis);
}
