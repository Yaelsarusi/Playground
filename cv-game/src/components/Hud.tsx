"use client";

import { useEffect, useState } from "react";
import { formatRange, profile } from "@/data/profile";
import { msUntilReset } from "@/game/constants";
import { LAYOUT_BY_ID } from "@/game/layout";

type Props = {
  /** null when multiplayer isn’t configured. */
  online: number | null;
  nearBlock: string | null;
  /** Lets the game hide touch controls while the CV is open. */
  onCvToggle: (open: boolean) => void;
};

export function Hud({ online, nearBlock, onCvToggle }: Props) {
  const [left, setLeft] = useState<number | null>(null);
  const [cvOpen, setCvOpenState] = useState(false);
  const setCvOpen = (open: boolean) => {
    setCvOpenState(open);
    onCvToggle(open);
  };

  useEffect(() => {
    const update = () => setLeft(msUntilReset());
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, []);

  const block = nearBlock ? LAYOUT_BY_ID.get(nearBlock) : undefined;
  const secs = left === null ? null : Math.ceil(left / 1000);

  return (
    <div className="hud">
      <header className="hud-card hud-title">
        <h1>{profile.name}</h1>
        <p>{profile.headline}</p>
        <nav>
          {profile.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
          <button type="button" onClick={() => setCvOpen(true)}>
            Read as a regular CV
          </button>
        </nav>
      </header>

      <div className="hud-card hud-status">
        <div className={secs !== null && secs <= 30 ? "hud-timer urgent" : "hud-timer"}>
          {secs === null ? "--:--" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}
        </div>
        <div className="hud-small">until reset</div>
        {online !== null && <div className="hud-small">{online} robot{online === 1 ? "" : "s"} online</div>}
      </div>

      {block && (
        <aside className="hud-card hud-info" style={{ borderColor: block.color }}>
          <div className="hud-small">{block.info.subtitle}</div>
          <h2>{block.info.title}</h2>
          {block.info.meta && <div className="hud-small">{block.info.meta}</div>}
          {block.info.body && <p>{block.info.body}</p>}
        </aside>
      )}

      <footer className="hud-card hud-help">
        <b>WASD / arrows</b> move · <b>Space</b> jump · <b>E</b> shove
      </footer>

      {cvOpen && <CvModal onClose={() => setCvOpen(false)} />}
    </div>
  );
}

function CvModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cv-backdrop" onClick={onClose}>
      <article className="cv" role="dialog" aria-modal="true" aria-label="CV" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cv-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h1>{profile.name}</h1>
        <p className="cv-headline">{profile.headline}</p>
        {profile.summary && <p>{profile.summary}</p>}

        <h2>Experience</h2>
        {profile.experience.map((e, i) => (
          <section key={i}>
            <h3>
              {e.title} · {e.company}
            </h3>
            <div className="hud-small">{[formatRange(e.start, e.end), e.location].filter(Boolean).join(" · ")}</div>
            {e.description && <p>{e.description}</p>}
          </section>
        ))}

        {profile.education.length > 0 && (
          <>
            <h2>Education</h2>
            {profile.education.map((ed, i) => (
              <section key={i}>
                <h3>{ed.school}</h3>
                <div className="hud-small">{[ed.degree, formatRange(ed.start, ed.end)].filter(Boolean).join(" · ")}</div>
              </section>
            ))}
          </>
        )}

        <h2>Skills</h2>
        <ul className="cv-skills">
          {profile.skills.map((s) => (
            <li key={s.name}>{s.name}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}
