import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { SkyDome } from './world/SkyDome';
import { World } from './world/World';

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 50 }} dpr={[1, 2]}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />

      <SkyDome />
      <World />

      <Stats />
    </Canvas>
  );
}
