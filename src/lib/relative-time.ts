/**
 * relative-time.ts — Minimal relative time formatter.
 * No external dependency. Formats epoch ms as "X min ago", "Xh ago", etc.
 */

export function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`;

  const d = new Date(epochMs);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(epochMs: number): { date: string; time: string } {
  const d = new Date(epochMs);
  const date = d.toLocaleDateString("en-AU", { year: "numeric", month: "2-digit", day: "2-digit" });
  const time = d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return { date, time };
}
