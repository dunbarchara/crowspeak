import type { SurfaceOptions } from '../lib/surface';
import type { FollowCameraOptions } from './followCamera';

export const SURFACE_OPTIONS: SurfaceOptions = {
  turnSpeed: 2.5,
  maxSpeed: 3,
  accel: 8,
};

export const FOLLOW_CAMERA_OPTIONS: FollowCameraOptions = {
  distance: 6, // behind the character
  height: 5, // above the character, along local up
  lookHeight: 0.5, // aim at the torso, not the feet
  posK: 8, // position smoothing (higher = tighter)
  upK: 5, // horizon roll smoothing
  clearance: 0.6, // minimum height above terrain
};
