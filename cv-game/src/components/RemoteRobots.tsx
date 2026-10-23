"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { Player, RobotMsg } from "@/game/net";
import { RobotModel } from "./RobotModel";

export type RemoteRobotState = { msg: RobotMsg; receivedAt: number };

type Props = {
  players: Player[];
  /** Latest message per player id, mutated in place by the network layer. */
  states: Map<string, RemoteRobotState>;
};

/** Other visitors' robots. Visual only: their pushes reach us as block updates from their owner. */
export function RemoteRobots({ players, states }: Props) {
  return (
    <>
      {players.map((p) => (
        <RemoteRobot key={p.id} player={p} states={states} />
      ))}
    </>
  );
}

function RemoteRobot({ player, states }: { player: Player; states: Map<string, RemoteRobotState> }) {
  const group = useRef<Group>(null);
  const visual = useRef<Group>(null);
  const moving = useRef(false);

  useFrame((_, dt) => {
    const s = states.get(player.id);
    const g = group.current;
    if (!g) return;
    g.visible = !!s;
    if (!s) return;
    const [x, y, z] = s.msg.p;
    const a = 1 - Math.exp(-dt * 12);
    if (g.position.lengthSq() === 0) g.position.set(x, y, z);
    else g.position.set(g.position.x + (x - g.position.x) * a, g.position.y + (y - g.position.y) * a, g.position.z + (z - g.position.z) * a);
    if (visual.current) {
      let d = s.msg.ry - visual.current.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      visual.current.rotation.y += d * a;
    }
    moving.current = s.msg.moving && performance.now() - s.receivedAt < 500;
  });

  return (
    <group ref={group} visible={false}>
      <group ref={visual}>
        <RobotModel color={player.color} name={player.name} isMoving={() => moving.current} />
      </group>
    </group>
  );
}
