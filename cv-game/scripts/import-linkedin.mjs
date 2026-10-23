#!/usr/bin/env node
// Converts a LinkedIn data export into src/data/profile.json.
//
// Get the export: LinkedIn → Settings & Privacy → Data privacy →
// "Get a copy of your data" → pick Profile, Positions, Skills, Education
// (and optionally Endorsements). Unzip it, then run:
//
//   npm run import-linkedin -- ~/Downloads/Basic_LinkedInDataExport_xx-xx-xxxx
//
// Existing `links` in profile.json are kept, everything else is replaced.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: npm run import-linkedin -- <path-to-unzipped-export>");
  process.exit(1);
}

const outFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/data/profile.json");

// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in fields).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** `column` is any header we expect, used to find the header row. */
function readCsv(name, column) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return [];
  const rows = parseCsv(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  // Some LinkedIn CSVs start with a "Notes:" preamble before the header row.
  const headerIdx = rows.findIndex((r) => r.some((f) => f.trim() === column));
  if (headerIdx < 0) return [];
  const header = rows[headerIdx].map((h) => h.trim());
  return rows.slice(headerIdx + 1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const orNull = (v) => (v ? v : null);

const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
const [me = {}] = readCsv("Profile.csv", "First Name");

const experience = readCsv("Positions.csv", "Company Name").map((p) => ({
  company: p["Company Name"],
  title: p["Title"],
  start: orNull(p["Started On"]),
  end: orNull(p["Finished On"]),
  location: p["Location"] || undefined,
  description: p["Description"] || undefined,
}));

const education = readCsv("Education.csv", "School Name").map((e) => ({
  school: e["School Name"],
  degree: e["Degree Name"] || undefined,
  start: orNull(e["Start Date"]),
  end: orNull(e["End Date"]),
}));

// Size skills by endorsement count when available (mapped to 1–5).
const endorsements = {};
for (const e of readCsv("Endorsement_Received_Info.csv", "Skill Name")) {
  const skill = e["Skill Name"];
  if (skill) endorsements[skill] = (endorsements[skill] ?? 0) + 1;
}
const maxEndorsements = Math.max(1, ...Object.values(endorsements));
const skills = readCsv("Skills.csv", "Name").map((s) => {
  const count = endorsements[s["Name"]] ?? 0;
  return { name: s["Name"], weight: count ? 1 + Math.round((count / maxEndorsements) * 4) : 2 };
});

const name = [me["First Name"], me["Last Name"]].filter(Boolean).join(" ");
const profile = {
  name: name || existing.name || "Your Name",
  headline: me["Headline"] || existing.headline || "",
  summary: me["Summary"] || existing.summary || "",
  links: existing.links ?? [],
  experience: experience.length ? experience : existing.experience ?? [],
  education: education.length ? education : existing.education ?? [],
  skills: skills.length ? skills : existing.skills ?? [],
};

fs.writeFileSync(outFile, JSON.stringify(profile, null, 2) + "\n");
console.log(
  `Wrote ${path.relative(process.cwd(), outFile)}: ${profile.experience.length} positions, ` +
    `${profile.skills.length} skills, ${profile.education.length} schools.`,
);
