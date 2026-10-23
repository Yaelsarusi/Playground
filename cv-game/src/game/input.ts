/** Shared, mutable input state written by keyboard + touch controls and read every frame by the robot. */
export const input = {
  keys: new Set<string>(),
  /** Touch joystick vector, x = right, y = forward, each in [-1, 1]. */
  stick: { x: 0, y: 0 },
  jump: false,
  shove: false,
};

const KEY_MAP: Record<string, string> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

export function bindKeyboard() {
  const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  const down = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    const k = KEY_MAP[e.code];
    if (k) {
      input.keys.add(k);
      e.preventDefault();
    }
    if (e.code === "Space") {
      input.jump = true;
      e.preventDefault();
    }
    if (e.code === "KeyE" || e.code === "KeyF") input.shove = true;
  };
  const up = (e: KeyboardEvent) => {
    const k = KEY_MAP[e.code];
    if (k) input.keys.delete(k);
  };
  const blur = () => input.keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

/** Movement direction in world space (x = right, z = toward the camera). Length ≤ 1. */
export function moveVector() {
  let x = input.stick.x;
  let z = -input.stick.y;
  if (input.keys.has("left")) x -= 1;
  if (input.keys.has("right")) x += 1;
  if (input.keys.has("forward")) z -= 1;
  if (input.keys.has("back")) z += 1;
  const len = Math.hypot(x, z);
  return len > 1 ? { x: x / len, z: z / len } : { x, z };
}

/** Returns true once per press. */
export function consume(action: "jump" | "shove") {
  const v = input[action];
  input[action] = false;
  return v;
}
