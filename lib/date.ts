const MS_PER_DAY = 86_400_000;

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
