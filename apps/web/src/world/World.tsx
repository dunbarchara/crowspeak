import { Player } from '../player/Player';
import { Planet } from './Planet';
import { useTerrain } from './useTerrain';

export function World() {
  const { params, heightFn } = useTerrain();

  return (
    <>
      <Planet heightFn={heightFn} params={params} />
      <Player heightFn={heightFn} />
    </>
  );
}
