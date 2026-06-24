/**
 * credits-page.tsx — Project credits & team page.
 *
 * Displays the "Plumbers of UTS" team. Each member card shows a QR code that
 * encodes the member's LinkedIn profile (scan to connect), their UTS degree
 * program, and a direct "Connect" link as an accessible fallback.
 */

import { GraduationCap, Linkedin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { TEAM_MEMBERS, type TeamMember, initialsOf } from "./team";

// High-contrast colors so the QR stays scannable regardless of theme.
const QR_BG = "#ffffff";
const QR_FG = "#0a0a0a";

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <li className="flex flex-col items-center gap-4 rounded-lg border border-border-default bg-bg-surface p-5 text-center">
      {/* QR code — scan to open the LinkedIn profile */}
      <div className="rounded-md border border-border-default bg-white p-2.5">
        <QRCodeSVG
          value={member.linkedin}
          size={140}
          bgColor={QR_BG}
          fgColor={QR_FG}
          level="M"
          marginSize={0}
          title={`LinkedIn QR code for ${member.name}`}
        />
      </div>

      {/* Identity */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[11px] font-semibold text-accent-text"
            aria-hidden={true}
          >
            {initialsOf(member.name)}
          </span>
          <span className="text-sm font-semibold text-fg-primary">{member.name}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-tertiary">
          <GraduationCap className="size-3.5 shrink-0" aria-hidden={true} />
          {member.degree}
        </span>
      </div>

      {/* Direct link — accessible fallback to scanning */}
      <a
        href={member.linkedin}
        target="_blank"
        rel="noreferrer"
        aria-label={`Connect with ${member.name} on LinkedIn (opens in a new tab)`}
        className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-[12px] font-medium text-fg-primary transition-colors duration-150 hover:border-accent hover:bg-bg-elevated hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1"
      >
        <Linkedin className="size-3.5 shrink-0" aria-hidden={true} />
        Connect
      </a>
    </li>
  );
}

export function CreditsPage() {
  return (
    <main id="main-content" className="overflow-y-auto p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-fg-primary">Credits</h1>
      </div>

      {/* Team */}
      <section aria-label="Team members">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TEAM_MEMBERS.map((member) => (
            <MemberCard key={member.name} member={member} />
          ))}
        </ul>
      </section>
    </main>
  );
}
