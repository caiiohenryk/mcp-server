/**
 * Display helpers. Dates are stored in UTC; the dashboard audience is in Brazil,
 * so they are rendered in America/Sao_Paulo.
 */
const TIME_ZONE = "America/Sao_Paulo";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const relativeFmt = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatDate(d: Date): string {
  return dateFmt.format(d);
}

export function formatDateTime(d: Date): string {
  return dateTimeFmt.format(d);
}

/** "há 3 dias", "em 2 meses"… relative to `now`. */
export function formatRelative(d: Date, now: Date): string {
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 86_400],
    ["month", 30 * 86_400],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (abs >= secs) return relativeFmt.format(Math.round(diffSec / secs), unit);
  }
  return "agora";
}

/** ISO `YYYY-MM-DD` (frontmatter `updated_at`) rendered as a pt-BR date, without TZ drift. */
export function formatIsoDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFmt.format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}
