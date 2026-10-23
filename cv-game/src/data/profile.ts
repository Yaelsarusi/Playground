import raw from "./profile.json";

export type Experience = {
  company: string;
  title: string;
  start: string | null;
  end: string | null;
  location?: string;
  description?: string;
};

export type Education = {
  school: string;
  degree?: string;
  start?: string | null;
  end?: string | null;
};

/** weight 1–5 controls the block size. */
export type Skill = { name: string; weight?: number };

export type Profile = {
  name: string;
  headline: string;
  summary?: string;
  links: { label: string; url: string }[];
  experience: Experience[];
  education: Education[];
  skills: Skill[];
};

export const profile = raw as Profile;

export function formatRange(start?: string | null, end?: string | null) {
  if (!start) return "";
  return `${start} – ${end ?? "Present"}`;
}
