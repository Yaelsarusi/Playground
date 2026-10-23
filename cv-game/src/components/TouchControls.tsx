"use client";

import { useRef, useState } from "react";
import { input } from "@/game/input";

const RADIUS = 50;

/** On-screen joystick + buttons, only visible on touch screens (see globals.css). */
export function TouchControls() {
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const move = (x: number, y: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = x - o.x;
    let dy = y - o.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    input.stick.x = dx / RADIUS;
    input.stick.y = -dy / RADIUS;
  };

  const end = () => {
    origin.current = null;
    setKnob({ x: 0, y: 0 });
    input.stick.x = 0;
    input.stick.y = 0;
  };

  return (
    <div className="touch">
      <div
        className="touch-stick"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => origin.current?.id === e.pointerId && move(e.clientX, e.clientY)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="touch-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        <button type="button" onPointerDown={() => (input.shove = true)}>
          Shove
        </button>
        <button type="button" onPointerDown={() => (input.jump = true)}>
          Jump
        </button>
      </div>
    </div>
  );
}
