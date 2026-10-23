"use client";

import { Text } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody, useBeforePhysicsStep } from "@react-three/rapier";
import { useEffect, useMemo, useState } from "react";
import { profile } from "@/data/profile";
import { ARENA_HALF, FONT, NET_TICK_MS } from "@/game/constants";
import { LAYOUT } from "@/game/layout";
import type { Net, Player } from "@/game/net";
import { WorldSync } from "@/game/sync";
import { Block } from "./Block";
import { PlayerRobot } from "./PlayerRobot";
import { RemoteRobots, type RemoteRobotState } from "./RemoteRobots";

type Props = {
  round: number;
  me: Player;
  net: Net | null;
  players: Player[];
  nearBlock: string | null;
  onNearBlock: (id: string | null) => void;
};

/** One round of the game. Remounted (keyed by round) every reset, which puts every block back. */
export function World({ round, me, net, players, nearBlock, onNearBlock }: Props) {
  const sync = useMemo(() => new WorldSync(me.id, round, net), [me.id, round, net]);
  const [robots] = useState(() => new Map<string, RemoteRobotState>());

  useEffect(() => {
    if (!net) return;
    const offs = [
      net.on("robot", (m) => {
        if (m.round === round && m.id !== me.id) robots.set(m.id, { msg: m, receivedAt: performance.now() });
      }),
      net.on("blocks", (m) => {
        if (m.round === round) sync.applyRemote(m.updates, m.from);
      }),
      net.on("leave", (id) => {
        robots.delete(id);
        sync.onPlayerLeft(id);
      }),
      net.on("syncRequest", (m) => {
        if (m.round !== round || m.from === me.id) return;
        // Everyone could answer; a random delay plus "someone already did" keeps it to ~one reply.
        const timer = setTimeout(() => {
          net.sendSyncResponse({ from: me.id, to: m.from, round, updates: sync.fullSnapshot() });
        }, Math.random() * 400);
        const off = net.on("syncResponse", (r) => {
          if (r.to === m.from) clearTimeout(timer);
        });
        setTimeout(off, 1000);
      }),
      net.on("syncResponse", (m) => {
        if (m.round === round && m.to === me.id) sync.applySnapshot(m.updates, m.from);
      }),
    ];
    // Ask whoever is already here what the mess looks like right now.
    const ask = () => sync.requestSnapshot();
    if (net.ready) ask();
    offs.push(net.on("ready", ask));

    const tick = setInterval(() => sync.tick(), NET_TICK_MS);
    const onHide = () => document.visibilityState === "hidden" && sync.releaseAll();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      offs.forEach((off) => off());
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onHide);
      sync.releaseAll();
      robots.clear();
    };
  }, [net, round, sync, me.id, robots]);

  const others = players.filter((p) => p.id !== me.id);

  return (
    <Physics gravity={[0, -20, 0]} timeStep="vary">
      <FollowRemote sync={sync} />
      <Arena />
      {LAYOUT.map((def) => (
        <Block key={def.id} def={def} sync={sync} highlighted={def.id === nearBlock} />
      ))}
      <PlayerRobot player={me} sync={sync} onNearBlock={onNearBlock} />
      <RemoteRobots players={others} states={robots} />
    </Physics>
  );
}

function FollowRemote({ sync }: { sync: WorldSync }) {
  useBeforePhysicsStep(() => sync.followRemote(0.35));
  return null;
}

function Arena() {
  const wallH = 1.2;
  const walls: { pos: [number, number, number]; size: [number, number, number] }[] = [
    { pos: [0, wallH / 2, -ARENA_HALF], size: [ARENA_HALF * 2 + 1, wallH, 1] },
    { pos: [0, wallH / 2, ARENA_HALF], size: [ARENA_HALF * 2 + 1, wallH, 1] },
    { pos: [-ARENA_HALF, wallH / 2, 0], size: [1, wallH, ARENA_HALF * 2 + 1] },
    { pos: [ARENA_HALF, wallH / 2, 0], size: [1, wallH, ARENA_HALF * 2 + 1] },
  ];
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[ARENA_HALF + 0.5, 0.5, ARENA_HALF + 0.5]} position={[0, -0.5, 0]} friction={1} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[ARENA_HALF * 2 + 1, ARENA_HALF * 2 + 1]} />
          <meshStandardMaterial color="#f6efe4" />
        </mesh>
        <gridHelper args={[ARENA_HALF * 2, ARENA_HALF * 2, "#e3d5c3", "#ece2d4"]} position={[0, 0.005, 0]} />
        {walls.map((w, i) => (
          <group key={i}>
            <CuboidCollider args={[w.size[0] / 2, 4, w.size[2] / 2]} position={[w.pos[0], 4, w.pos[2]]} />
            <mesh position={w.pos} castShadow receiveShadow>
              <boxGeometry args={w.size} />
              <meshStandardMaterial color="#ffb4a2" />
            </mesh>
          </group>
        ))}
      </RigidBody>
      {/* Name painted on the floor at the spawn point */}
      <group position={[0, 0.01, 9.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <Text font={FONT} fontSize={1.1} color="#1d3557" anchorX="center" anchorY="bottom" maxWidth={20} textAlign="center">
          {profile.name}
        </Text>
        <Text font={FONT} fontSize={0.5} color="#457b9d" anchorX="center" anchorY="top" position={[0, -0.15, 0]} maxWidth={20} textAlign="center">
          {profile.headline}
        </Text>
      </group>
    </>
  );
}
