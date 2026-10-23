"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { currentRound, ROBOT_COLORS } from "@/game/constants";
import { bindKeyboard } from "@/game/input";
import { createNet, type Net, type Player } from "@/game/net";
import { Hud } from "./Hud";
import { TouchControls } from "./TouchControls";
import { World } from "./World";

function loadPlayer(): Player {
  let saved: Partial<Player> = {};
  try {
    saved = JSON.parse(localStorage.getItem("cv-robot") ?? "{}");
  } catch {}
  const player: Player = {
    // A fresh id per tab so two tabs are two robots.
    id: crypto.randomUUID(),
    name: saved.name ?? `Robot-${Math.floor(Math.random() * 9000 + 1000)}`,
    color: saved.color ?? ROBOT_COLORS[Math.floor(Math.random() * ROBOT_COLORS.length)],
  };
  try {
    localStorage.setItem("cv-robot", JSON.stringify({ name: player.name, color: player.color }));
  } catch {}
  return player;
}

export default function Game() {
  const [me] = useState(loadPlayer);
  const [net, setNet] = useState<Net | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [round, setRound] = useState(currentRound);
  const [nearBlock, setNearBlock] = useState<string | null>(null);
  const [cvOpen, setCvOpen] = useState(false);
  // Phones: fewer pixels and a smaller shadow map keep the frame rate up.
  const [isTouch] = useState(() => window.matchMedia("(pointer: coarse)").matches);

  useEffect(() => bindKeyboard(), []);

  useEffect(() => {
    const n = createNet(me);
    const offs = [n.on("ready", () => setNet(n)), n.on("players", setPlayers)];
    return () => {
      offs.forEach((off) => off());
      n.dispose();
      setNet(null);
    };
  }, [me]);

  useEffect(() => {
    const id = setInterval(() => setRound(currentRound()), 250);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <Canvas shadows camera={{ position: [0, 9, 15], fov: 50 }} dpr={isTouch ? [1, 1.5] : [1, 2]}>
        <color attach="background" args={["#bde0fe"]} />
        <fog attach="fog" args={["#bde0fe", 30, 60]} />
        <hemisphereLight args={["#ffffff", "#f6efe4", 1.2]} />
        <directionalLight
          position={[10, 18, 8]}
          intensity={2}
          castShadow
          shadow-mapSize={isTouch ? [1024, 1024] : [2048, 2048]}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={22}
          shadow-camera-bottom={-22}
        />
        <Suspense fallback={null}>
          <World key={round} round={round} me={me} net={net} players={players} nearBlock={nearBlock} onNearBlock={setNearBlock} />
        </Suspense>
      </Canvas>
      <Hud online={net ? Math.max(1, players.length) : null} nearBlock={nearBlock} onCvToggle={setCvOpen} />
      {!cvOpen && <TouchControls />}
    </>
  );
}
