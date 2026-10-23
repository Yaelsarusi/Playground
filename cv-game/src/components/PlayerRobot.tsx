"use client";

import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useRef } from "react";
import { Vector3, type Group } from "three";
import { NET_TICK_MS } from "@/game/constants";
import { consume, moveVector } from "@/game/input";
import { LAYOUT_BY_ID } from "@/game/layout";
import type { Player } from "@/game/net";
import type { WorldSync } from "@/game/sync";
import { RobotModel } from "./RobotModel";

const SPAWN: [number, number, number] = [0, 0.2, 5];
const SPEED = 5.5;
const JUMP = 6.5;
const CAMERA_OFFSET = new Vector3(0, 8.5, 10);
const SHOVE_RANGE = 2.8;
const NEAR_RANGE = 2.2;

type Props = {
  player: Player;
  sync: WorldSync;
  onNearBlock: (id: string | null) => void;
};

export function PlayerRobot({ player, sync, onNearBlock }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<Group>(null);
  const moving = useRef(false);
  const facing = useRef(Math.PI);
  const lastSent = useRef({ at: 0, x: 0, z: 0, ry: 0 });
  const nearCheck = useRef({ at: 0, id: null as string | null });
  const shoveCooldown = useRef(0);
  const { world, rapier } = useRapier();
  const camTarget = useRef(new Vector3());

  useFrame(({ camera, clock, size }, dt) => {
    const rb = body.current;
    if (!rb) return;
    const now = clock.elapsedTime;
    const pos = rb.translation();

    if (pos.y < -10) {
      rb.setTranslation({ x: SPAWN[0], y: SPAWN[1] + 2, z: SPAWN[2] }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    // Walk
    const dir = moveVector();
    const vel = rb.linvel();
    rb.setLinvel({ x: dir.x * SPEED, y: vel.y, z: dir.z * SPEED }, true);
    moving.current = Math.hypot(dir.x, dir.z) > 0.1;
    if (moving.current) {
      const target = Math.atan2(dir.x, dir.z);
      let delta = target - facing.current;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      facing.current += delta * Math.min(1, dt * 12);
    }
    if (visual.current) visual.current.rotation.y = facing.current;

    // Jump if something is right under our feet
    if (consume("jump")) {
      const ray = new rapier.Ray({ x: pos.x, y: pos.y + 0.1, z: pos.z }, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, 0.25, true, undefined, undefined, undefined, rb);
      if (hit) rb.setLinvel({ x: vel.x, y: JUMP, z: vel.z }, true);
    }

    // Shove: blast nearby blocks in front of us
    if (consume("shove") && now > shoveCooldown.current) {
      shoveCooldown.current = now + 0.5;
      const fx = Math.sin(facing.current);
      const fz = Math.cos(facing.current);
      for (const id of sync.ids()) {
        const b = sync.body(id);
        if (!b) continue;
        const t = b.translation();
        const dx = t.x - pos.x;
        const dz = t.z - pos.z;
        const dist = Math.hypot(dx, dz);
        const reach = SHOVE_RANGE + (LAYOUT_BY_ID.get(id)?.size[0] ?? 1) / 2;
        if (dist > reach || (dx * fx + dz * fz) / (dist || 1) < 0.3) continue;
        sync.claim(id, true);
        const m = b.mass();
        b.applyImpulse({ x: fx * m * 7, y: m * 3.5, z: fz * m * 7 }, true);
        b.applyTorqueImpulse({ x: (Math.random() - 0.5) * m, y: (Math.random() - 0.5) * m, z: (Math.random() - 0.5) * m }, true);
      }
    }

    // Follow camera
    // Narrow (portrait) screens see less of the arena sideways, so pull the camera back.
    const aspect = size.width / size.height;
    const zoomOut = aspect < 1 ? Math.min(1.8, 0.75 / aspect + 0.25) : 1;
    camTarget.current.copy(CAMERA_OFFSET).multiplyScalar(zoomOut).add(pos);
    camera.position.lerp(camTarget.current, 1 - Math.exp(-dt * 4));
    camera.lookAt(pos.x, pos.y + 1, pos.z);

    // Which block are we next to? (for the info card)
    if (now - nearCheck.current.at > 0.2) {
      nearCheck.current.at = now;
      let best: string | null = null;
      let bestDist = Infinity;
      for (const id of sync.ids()) {
        const b = sync.body(id);
        const def = LAYOUT_BY_ID.get(id);
        if (!b || !def) continue;
        const t = b.translation();
        const d = Math.hypot(t.x - pos.x, t.z - pos.z) - Math.max(def.size[0], def.size[2]) / 2;
        if (d < NEAR_RANGE && d < bestDist) {
          best = id;
          bestDist = d;
        }
      }
      if (best !== nearCheck.current.id) {
        nearCheck.current.id = best;
        onNearBlock(best);
      }
    }

    // Tell everyone where we are (skip if idle, but keep a slow heartbeat)
    const sinceSent = performance.now() - lastSent.current.at;
    const changed =
      Math.abs(pos.x - lastSent.current.x) + Math.abs(pos.z - lastSent.current.z) + Math.abs(facing.current - lastSent.current.ry) > 0.01;
    if (sync.net && sinceSent > NET_TICK_MS && (changed || sinceSent > 2000)) {
      lastSent.current = { at: performance.now(), x: pos.x, z: pos.z, ry: facing.current };
      sync.net.sendRobot({ id: player.id, round: sync.round, p: [pos.x, pos.y, pos.z], ry: facing.current, moving: moving.current });
    }
  });

  return (
    <RigidBody
      ref={body}
      position={SPAWN}
      colliders={false}
      enabledRotations={[false, false, false]}
      canSleep={false}
      ccd
      userData={{ robot: player.id }}
      onCollisionEnter={({ other }) => {
        const blockId = other.rigidBodyObject?.userData?.blockId as string | undefined;
        if (blockId) sync.claim(blockId, true);
      }}
    >
      <CapsuleCollider args={[0.45, 0.45]} position={[0, 0.9, 0]} density={8} friction={0.2} />
      <group ref={visual}>
        <RobotModel color={player.color} isMoving={() => moving.current} />
      </group>
    </RigidBody>
  );
}
