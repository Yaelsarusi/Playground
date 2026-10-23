import { formatRange, profile, type Profile } from "@/data/profile";
import { ARENA_HALF, BLOCK_COLORS } from "./constants";

export type BlockShape = "box" | "cylinder" | "ball" | "hex";

export type BlockDef = {
  id: string;
  kind: "experience" | "education" | "skill";
  shape: BlockShape;
  /** box: [width, height, depth]; cylinder/hex: [diameter, height, diameter]; ball: [diameter, …] */
  size: [number, number, number];
  color: string;
  label: string;
  sublabel?: string;
  position: [number, number, number];
  rotationY: number;
  /** Shown in the info card when the robot gets close. */
  info: { title: string; subtitle?: string; meta?: string; body?: string };
};

// Small seeded PRNG so every visitor gets the exact same starting layout.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKILL_SHAPES: BlockShape[] = ["box", "cylinder", "box", "hex", "ball"];

export function buildLayout(p: Profile = profile): BlockDef[] {
  const rand = mulberry32(42);
  const blocks: BlockDef[] = [];
  const placed: { x: number; z: number; r: number }[] = [{ x: 0, z: 4, r: 3 }]; // keep the spawn clear

  const fits = (x: number, z: number, r: number) =>
    Math.abs(x) + r < ARENA_HALF - 0.5 &&
    Math.abs(z) + r < ARENA_HALF - 0.5 &&
    placed.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + 0.3);

  // Experience: big slabs in an arc in front of the spawn point, newest in the middle.
  const n = p.experience.length;
  p.experience.forEach((e, i) => {
    const width = 4.2;
    const angle = (i - (n - 1) / 2) * 0.42;
    const radius = 9 + Math.floor(i / 7) * 3.5;
    const x = Math.sin(angle) * radius;
    const z = -Math.cos(angle) * radius + 3;
    placed.push({ x, z, r: width / 2 });
    blocks.push({
      id: `exp-${i}`,
      kind: "experience",
      shape: "box",
      size: [width, 2, 1.2],
      color: BLOCK_COLORS.experience[i % BLOCK_COLORS.experience.length],
      label: e.company,
      sublabel: e.title,
      position: [x, 1, z],
      rotationY: -angle,
      info: { title: e.title, subtitle: e.company, meta: [formatRange(e.start, e.end), e.location].filter(Boolean).join(" · "), body: e.description },
    });
  });

  // Education: chunky pillars off to the sides.
  p.education.forEach((ed, i) => {
    const x = (i % 2 === 0 ? -1 : 1) * (11 + Math.floor(i / 2) * 3);
    const z = 6;
    placed.push({ x, z, r: 1.2 });
    blocks.push({
      id: `edu-${i}`,
      kind: "education",
      shape: "cylinder",
      size: [2.2, 2.4, 2.2],
      color: BLOCK_COLORS.education[i % BLOCK_COLORS.education.length],
      label: ed.school,
      sublabel: ed.degree,
      position: [x, 1.2, z],
      rotationY: 0,
      info: { title: ed.school, subtitle: ed.degree, meta: formatRange(ed.start, ed.end) },
    });
  });

  // Skills: scattered around, size by weight.
  p.skills.forEach((s, i) => {
    const weight = Math.min(5, Math.max(1, s.weight ?? 2));
    const side = 0.8 + weight * 0.22;
    const shape = SKILL_SHAPES[i % SKILL_SHAPES.length];
    const r = side * 0.75;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 200; tries++) {
      const a = rand() * Math.PI * 2;
      const d = 4 + rand() * (ARENA_HALF - 5);
      x = Math.cos(a) * d;
      z = Math.sin(a) * d;
      if (fits(x, z, r)) break;
    }
    placed.push({ x, z, r });
    blocks.push({
      id: `skill-${i}`,
      kind: "skill",
      shape,
      size: [side, side, side],
      color: BLOCK_COLORS.skill[i % BLOCK_COLORS.skill.length],
      label: s.name,
      position: [x, side / 2 + 0.02, z],
      rotationY: rand() * Math.PI,
      info: { title: s.name, subtitle: "Skill", meta: "★".repeat(weight) + "☆".repeat(5 - weight) },
    });
  });

  return blocks;
}

export const LAYOUT = buildLayout();
export const LAYOUT_BY_ID = new Map(LAYOUT.map((b) => [b.id, b]));
