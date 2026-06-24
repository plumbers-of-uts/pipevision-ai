/**
 * team.ts — Plumbers of UTS team roster (single source of truth).
 *
 * Kept as a plain module (no JSX) so the data and helpers are unit-testable in
 * the node test environment without pulling in React.
 */

export interface TeamMember {
  name: string;
  /** Degree program at UTS. */
  degree: string;
  /** LinkedIn profile URL. */
  linkedin: string;
}

// Listed alphabetically by first name. All Master of AI except Chi Sum (Bachelor of IT).
export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    name: "Bo Zhao",
    degree: "Master of AI",
    linkedin: "https://www.linkedin.com/in/bo-zhao-334550364/",
  },
  {
    name: "Chi Sum Lau",
    degree: "Bachelor of IT",
    linkedin: "https://www.linkedin.com/in/chi-sum-grace-lau-008950245/",
  },
  {
    name: "Eunkwang Shin",
    degree: "Master of AI",
    linkedin: "https://www.linkedin.com/in/gracefullight/",
  },
  {
    name: "Jadyn Braganza",
    degree: "Master of AI",
    linkedin: "https://www.linkedin.com/in/jadyn-braganza/",
  },
];

/** Build initials from a member name (first letter of first + last word). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
