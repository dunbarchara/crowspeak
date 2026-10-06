import { useMemo } from 'react';
import { BackSide, Color } from 'three';
import { SKY_BOTTOM_COLOR, SKY_SCALE, SKY_TOP_COLOR } from './constants';

export function SkyDome() {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new Color(SKY_TOP_COLOR) },
      bottomColor: { value: new Color(SKY_BOTTOM_COLOR) },
    }),
    [],
  );

  return (
    <mesh scale={SKY_SCALE}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          varying vec3 vDir;
          void main() {
            float t = smoothstep(-0.2, 0.8, vDir.y);
            gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
          }
        `}
      />
    </mesh>
  );
}
