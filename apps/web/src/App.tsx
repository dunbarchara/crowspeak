import { Hud } from './hud/Hud';
import { PhaserGame } from './world/PhaserGame';

export default function App() {
  return (
    <div className="app">
      <PhaserGame />
      <Hud />
    </div>
  );
}
