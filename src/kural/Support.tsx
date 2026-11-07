"use client";
import { HeartHandshake } from "lucide-react";
import { SUPPORT, type Concern } from "./concern";

/** Support comes before any couplet, in Reflect and in Ask. Keeps the look of his crisis notice. */
export function Support({ concern }: { concern: Exclude<Concern, null> }) {
  const { title, text, lines } = SUPPORT[concern];
  return (
    <section aria-label="Support" role="alert" className="rounded-3 border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-danger-soft p-4">
      <div className="flex items-center gap-2 text-danger">
        <HeartHandshake size={16} />
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
      </div>
      <p className="mt-1.5 text-[13px] leading-5 text-text-2">{text}</p>
      <ul className="mt-2 space-y-0.5 text-[13px]">
        {lines.map((l) => (
          <li key={l.label}>
            <span className="text-text-3">{l.label}: </span>
            {l.href ? (
              <a className="font-semibold text-text underline underline-offset-2" href={l.href} {...(l.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
                {l.contact}
              </a>
            ) : (
              <span className="font-semibold text-text">{l.contact}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** After a self-harm concern the couplets wait. Seeing them is the reader's choice, and a small one. */
export function ShowAnyway({ onClick }: { onClick: () => void }) {
  return (
    <button className="text-[12.5px] font-medium text-text-2 underline underline-offset-2 hover:text-text" onClick={onClick}>
      Show the couplets anyway
    </button>
  );
}
