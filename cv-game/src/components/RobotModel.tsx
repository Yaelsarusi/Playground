"use client";

import { Billboard, RoundedBox, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { FONT } from "@/game/constants";

type Props = {
  color: string;
  name?: string;
  /** Read every frame so the animation follows movement without re-rendering. */
  isMoving: () => boolean;
};

/** A little toy robot built from primitives. Its feet sit at y = 0, total height ≈ 1.8. */
export function RobotModel({ color, name, isMoving }: Props) {
  const rig = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const antenna = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const moving = isMoving();
    if (rig.current) rig.current.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.06 : Math.sin(t * 2) * 0.015;
    const swing = moving ? Math.sin(t * 12) * 0.7 : Math.sin(t * 1.5) * 0.08;
    if (leftArm.current) leftArm.current.rotation.x = swing;
    if (rightArm.current) rightArm.current.rotation.x = -swing;
    if (antenna.current) antenna.current.rotation.z = Math.sin(t * (moving ? 10 : 3)) * 0.15;
  });

  return (
    <group>
      <group ref={rig}>
        {/* feet */}
        {[-0.22, 0.22].map((x) => (
          <RoundedBox key={x} args={[0.26, 0.2, 0.42]} radius={0.06} position={[x, 0.1, 0.04]} castShadow>
            <meshStandardMaterial color="#2b2d42" roughness={0.6} />
          </RoundedBox>
        ))}
        {/* legs */}
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.25, 12]} />
            <meshStandardMaterial color="#8d99ae" metalness={0.4} roughness={0.4} />
          </mesh>
        ))}
        {/* body */}
        <RoundedBox args={[0.9, 0.7, 0.6]} radius={0.12} position={[0, 0.75, 0]} castShadow>
          <meshStandardMaterial color={color} roughness={0.35} />
        </RoundedBox>
        {/* chest light */}
        <mesh position={[0, 0.8, 0.305]}>
          <circleGeometry args={[0.09, 24]} />
          <meshStandardMaterial color="#fff3b0" emissive="#ffd166" emissiveIntensity={1.5} />
        </mesh>
        {/* arms */}
        {[
          { ref: leftArm, x: -0.53 },
          { ref: rightArm, x: 0.53 },
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, 0.98, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.08, 0.3, 4, 12]} />
              <meshStandardMaterial color="#8d99ae" metalness={0.4} roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.45, 0]} castShadow>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshStandardMaterial color={color} roughness={0.35} />
            </mesh>
          </group>
        ))}
        {/* neck + head */}
        <mesh position={[0, 1.14, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.1, 12]} />
          <meshStandardMaterial color="#8d99ae" />
        </mesh>
        <RoundedBox args={[0.72, 0.5, 0.56]} radius={0.14} position={[0, 1.42, 0]} castShadow>
          <meshStandardMaterial color="#f1faee" roughness={0.3} />
        </RoundedBox>
        {/* face screen + eyes */}
        <RoundedBox args={[0.56, 0.3, 0.04]} radius={0.06} position={[0, 1.42, 0.27]}>
          <meshStandardMaterial color="#1d3557" roughness={0.2} />
        </RoundedBox>
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} position={[x, 1.44, 0.3]}>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshStandardMaterial color="#a8dadc" emissive="#4cc9f0" emissiveIntensity={2} />
          </mesh>
        ))}
        {/* antenna */}
        <group ref={antenna} position={[0, 1.67, 0]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
            <meshStandardMaterial color="#8d99ae" />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
          </mesh>
        </group>
      </group>
      {name && (
        <Billboard position={[0, 2.25, 0]}>
          <Text font={FONT} fontSize={0.22} color="#1d3557" outlineWidth={0.02} outlineColor="#ffffff" anchorX="center" anchorY="middle">
            {name}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
