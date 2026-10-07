// The character's body. The group origin is at the feet, so the parent can
// place it directly on the terrain. Local +Z is forward.
export function Character() {
  return (
    <>
      <mesh position={[0, 0.3, 0]}>
        <capsuleGeometry args={[0.15, 0.3, 4, 8]} />
        <meshStandardMaterial color="tomato" />
      </mesh>
      {/* a nose, so you can see which way it faces (+Z) */}
      <mesh position={[0, 0.4, 0.2]}>
        <boxGeometry args={[0.1, 0.1, 0.15]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </>
  );
}
