"use client";

import dynamic from "next/dynamic";

// three.js / WebGL only work in the browser, so skip server rendering for the game.
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <div className="loading">Booting up your robot…</div>,
});

export function GameLoader() {
  return <Game />;
}
