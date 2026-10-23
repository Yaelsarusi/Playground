/** Every client resets the world on the same wall-clock boundary. */
export const ROUND_MS = 10 * 60 * 1000;

/** Half the side length of the square arena. */
export const ARENA_HALF = 18;

/** How often (ms) we broadcast our robot and the blocks we own. */
export const NET_TICK_MS = 100;

export const ROBOT_COLORS = ["#ff6b6b", "#ffb703", "#06d6a0", "#4cc9f0", "#9b5de5", "#f15bb5"];

export const BLOCK_COLORS = {
  experience: ["#3a86ff", "#8338ec", "#ff006e", "#fb5607", "#2a9d8f"],
  education: ["#e9c46a", "#f4a261"],
  skill: ["#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#90be6d", "#f9844a", "#b5838d", "#4d908e"],
};

export function currentRound(now = Date.now()) {
  return Math.floor(now / ROUND_MS);
}

export function msUntilReset(now = Date.now()) {
  return ROUND_MS - (now % ROUND_MS);
}

/** Self-hosted so labels render without fetching fonts from a CDN. */
export const FONT = "/fonts/fredoka-600.woff";
