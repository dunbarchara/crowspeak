import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { HeightFn } from '../lib/terrain';
import {
  orientationOnSurface,
  stepOnSurface,
  type MoveInput,
  type SurfaceState,
} from '../lib/surface';
import { Character } from './Character';
import { FOLLOW_CAMERA_OPTIONS, SURFACE_OPTIONS } from './constants';
import { followCamera } from './followCamera';
import { useKeys } from './useKeys';

type PlayerProps = {
  heightFn: HeightFn;
};

// reused every frame to avoid allocating
const input: MoveInput = { turn: 0, move: 0 };

export function Player({ heightFn }: PlayerProps) {
  const group = useRef<Group>(null);
  const keys = useKeys();
  const camera = useThree((s) => s.camera);
  const state = useRef<SurfaceState>({
    pos: new Vector3(0, 0, 5),
    heading: new Vector3(0, 1, 0),
    speed: 0,
  });

  useFrame((_, rawDelta) => {
    if (!group.current) return;
    const s = state.current;
    const k = keys.current;
    const dt = Math.min(rawDelta, 0.05);

    // keyboard -> movement on the surface (see lib/surface.ts)
    input.turn = (k.has('KeyA') ? 1 : 0) - (k.has('KeyD') ? 1 : 0);
    input.move = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    stepOnSurface(s, input, dt, heightFn, SURFACE_OPTIONS);

    orientationOnSurface(s, group.current.quaternion);
    group.current.position.copy(s.pos);

    // after the move, in the same callback, so the camera doesn't lag a frame
    followCamera(camera, s, heightFn, dt, FOLLOW_CAMERA_OPTIONS);
  });

  return (
    <group ref={group}>
      <Character />
    </group>
  );
}
