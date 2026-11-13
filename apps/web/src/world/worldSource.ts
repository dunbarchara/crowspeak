import { HttpWorldSource } from '../lib/worldLoader';

/** Bundled worlds live in `public/worlds/<world_id@version>/` and are served as static files. */
export const worldSource = new HttpWorldSource(
  `${import.meta.env.BASE_URL}worlds`,
);

export const DEFAULT_WORLD = 'plaza@1';
