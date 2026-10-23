"use client";

import { RoundedBox, Text } from "@react-three/drei";
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import { FONT } from "@/game/constants";
import type { BlockDef } from "@/game/layout";
import type { WorldSync } from "@/game/sync";

type Props = { def: BlockDef; sync: WorldSync; highlighted: boolean };

const DENSITY = { experience: 0.6, education: 0.8, skill: 0.4 };

export function Block({ def, sync, highlighted }: Props) {
  const ref = useRef<RapierRigidBody>(null);

  useEffect(() => {
    sync.register(def.id, () => ref.current);
    return () => sync.unregister(def.id);
  }, [def.id, sync]);

  const [w, h, d] = def.size;
  const emissive = highlighted ? def.color : "#000000";
  const material = <meshStandardMaterial color={def.color} roughness={0.45} emissive={emissive} emissiveIntensity={0.25} />;

  return (
    <RigidBody
      ref={ref}
      position={def.position}
      rotation={[0, def.rotationY, 0]}
      colliders={false}
      userData={{ blockId: def.id }}
      linearDamping={0.3}
      angularDamping={0.4}
      onCollisionEnter={({ other }) => sync.onBlockContact(def.id, other.rigidBodyObject?.userData?.blockId as string | undefined)}
    >
      {def.shape === "box" && (
        <>
          <CuboidCollider args={[w / 2, h / 2, d / 2]} density={DENSITY[def.kind]} friction={0.7} />
          <RoundedBox args={[w, h, d]} radius={Math.min(w, h, d) * 0.12} castShadow receiveShadow>
            {material}
          </RoundedBox>
          {(def.kind === "skill" ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : [0, Math.PI]).map((a) => (
            <group key={a} position={[Math.sin(a) * (d / 2 + 0.01), 0, Math.cos(a) * (d / 2 + 0.01)]} rotation={[0, a, 0]}>
              <Label def={def} width={w} height={h} />
            </group>
          ))}
        </>
      )}
      {(def.shape === "cylinder" || def.shape === "hex") && (
        <>
          <CylinderCollider args={[h / 2, w / 2]} density={DENSITY[def.kind]} friction={0.7} />
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[w / 2, w / 2, h, def.shape === "hex" ? 6 : 32]} />
            {material}
          </mesh>
          <group position={[0, h / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <Label def={def} width={w * 0.85} height={w * 0.85} />
          </group>
        </>
      )}
      {def.shape === "ball" && (
        <>
          <BallCollider args={[w / 2]} density={DENSITY[def.kind]} friction={0.7} />
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[w / 2, 32, 32]} />
            {material}
          </mesh>
          {[1, -1].map((side) => (
            <group key={side} position={[0, 0, (side * w) / 2 + side * 0.02]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
              <Label def={def} width={w * 0.8} height={w * 0.5} />
            </group>
          ))}
        </>
      )}
    </RigidBody>
  );
}

function Label({ def, width, height }: { def: BlockDef; width: number; height: number }) {
  const big = def.kind === "skill" ? Math.min(0.32, width / Math.max(4, def.label.length * 0.62)) : 0.34;
  return (
    <>
      <Text
        font={FONT}
        fontSize={big}
        maxWidth={width * 0.9}
        textAlign="center"
        anchorX="center"
        anchorY={def.sublabel ? "bottom" : "middle"}
        position={[0, def.sublabel ? 0.02 : 0, 0]}
        color="#ffffff"
        outlineWidth={big * 0.06}
        outlineColor="#1d3557"
      >
        {def.label}
      </Text>
      {def.sublabel && (
        <Text
          font={FONT}
          fontSize={Math.min(0.2, height * 0.12)}
          maxWidth={width * 0.9}
          textAlign="center"
          anchorX="center"
          anchorY="top"
          position={[0, -0.06, 0]}
          color="#f1faee"
        >
          {def.sublabel}
        </Text>
      )}
    </>
  );
}
