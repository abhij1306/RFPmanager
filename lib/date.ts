const MS_PER_DAY = 86_400_000;

/** Tender dates use named months or ISO dates. Numeric day/month dates are accepted only when unambiguous. */
export function parseTenderDate(value?: string | null): string | null {
  if (!value) return null;
  const source = value.trim();
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  let year: number;
  let month: number;
  let day: number;
  let match = /\b(20\d{2})-(\d{1,2})-(\d{1,2})(?=$|[^\w]|T\d{2}:)/.exec(source);
  if (match) {
    [, year, month, day] = match.map(Number);
  } else {
    match = /\b(\d{1,2})(?:st|nd|rd|th)?[\s,./-]+([A-Za-z]{3,9})[\s,./-]+(20\d{2})\b/i.exec(source);
    if (match) {
      day = Number(match[1]); month = months.indexOf(match[2].slice(0, 3).toLowerCase()) + 1; year = Number(match[3]);
    } else {
      match = /\b([A-Za-z]{3,9})[\s,./-]+(\d{1,2})(?:st|nd|rd|th)?[,]?[\s,./-]+(20\d{2})\b/i.exec(source);
      if (match) {
        month = months.indexOf(match[1].slice(0, 3).toLowerCase()) + 1; day = Number(match[2]); year = Number(match[3]);
      } else {
        match = /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/.exec(source);
        if (!match || Number(match[1]) <= 12) return null;
        day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
      }
    }
  }
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDateOnly(value: string | null): string {
  if (!value) return "No date set";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return value;
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() + 1 !== Number(match[2]) || date.getDate() !== Number(match[3])) return value;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function daysUntil(dateValue: string | null, now = new Date()): number | null {
  if (!dateValue) {
    return null;
  }

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((date.getTime() - today.getTime()) / MS_PER_DAY);
}

export function closingDateState(dateValue: string | null, now = new Date()): "overdue" | "soon" | "normal" {
  const days = daysUntil(dateValue, now);

  if (days === null) {
    return "normal";
  }

  if (days < 0) {
    return "overdue";
  }

  if (days <= 7) {
    return "soon";
  }

  return "normal";
}

export function isClosingSoon(dateValue: string | null, now = new Date()): boolean {
  const days = daysUntil(dateValue, now);
  return days !== null && days >= 0 && days <= 7;
}
