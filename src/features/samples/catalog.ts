/**
 * catalog.ts — Sample pipe inspection images for the Detect page demo.
 *
 * Each sample has an SVG data URL depicting a pipe interior with a severity
 * tint. The defectClasses array controls which classes appear in the mock
 * detection result when "Run Detection" is clicked with that sample active.
 *
 * SVG approach mirrors seed.ts thumbnail generation — coloured pipe circles
 * with different tints for visual variety.
 */

export interface SampleImage {
  id: string;
  label: string;
  severity: "critical" | "high" | "medium" | "low" | "none";
  dataUrl: string;
  /** classId values from PIPEVISION_CLASSES for mock detection */
  defectClasses: number[];
}

function buildSampleSvg(
  tintHex: string,
  label: string,
  crack?: boolean,
  debris?: boolean,
  joint?: boolean,
): string {
  const crackSvg = crack
    ? `
  <line x1="100" y1="60" x2="90" y2="120" stroke="${tintHex}" stroke-width="2.5" stroke-opacity="0.8"/>
  <line x1="112" y1="75" x2="118" y2="130" stroke="${tintHex}" stroke-width="1.5" stroke-opacity="0.6"/>`
    : "";

  const debrisSvg = debris
    ? `
  <ellipse cx="100" cy="140" rx="35" ry="10" fill="${tintHex}" fill-opacity="0.35"/>`
    : "";

  const jointSvg = joint
    ? `
  <rect x="52" y="85" width="10" height="30" rx="2" fill="${tintHex}" fill-opacity="0.5"/>
  <rect x="138" y="85" width="10" height="30" rx="2" fill="${tintHex}" fill-opacity="0.5"/>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <title>${label}</title>
  <rect width="200" height="200" fill="#1a1f2e"/>
  <rect x="10" y="10" width="180" height="180" rx="4" fill="#0f1420" stroke="#2a3040" stroke-width="1"/>
  <circle cx="100" cy="100" r="72" fill="#2a3040" stroke="#3a4560" stroke-width="2"/>
  <circle cx="100" cy="100" r="62" fill="#1e2535"/>
  <circle cx="100" cy="100" r="52" fill="${tintHex}" fill-opacity="0.2"/>
  <circle cx="100" cy="100" r="52" fill="none" stroke="${tintHex}" stroke-width="2.5" stroke-opacity="0.7"/>
  ${crackSvg}${debrisSvg}${jointSvg}
  <rect x="20" y="170" width="160" height="22" rx="3" fill="#0f1420" fill-opacity="0.88"/>
  <text x="100" y="185" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="${tintHex}" font-weight="600">${label}</text>
</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export const SAMPLE_CATALOG: SampleImage[] = [
  {
    id: "sample-crack",
    label: "Crack",
    severity: "medium",
    dataUrl: buildSampleSvg("#b8860b", "Longitudinal Crack", true, false, false),
    defectClasses: [1, 1], // Crack × 2
  },
  {
    id: "sample-hole",
    label: "Hole",
    severity: "critical",
    dataUrl: buildSampleSvg("#d9363e", "Pipe Hole", false, false, false),
    defectClasses: [3, 0], // Hole + Buckling
  },
  {
    id: "sample-debris",
    label: "Debris",
    severity: "low",
    dataUrl: buildSampleSvg("#1a8a4a", "Debris Deposit", false, true, false),
    defectClasses: [2, 4], // Debris + Joint offset
  },
  {
    id: "sample-joint",
    label: "Joint Offset",
    severity: "medium",
    dataUrl: buildSampleSvg("#b8860b", "Joint Offset", false, false, true),
    defectClasses: [4, 6], // Joint offset + Utility intrusion
  },
];
