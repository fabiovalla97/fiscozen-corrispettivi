import { config } from "../config.js";

/**
 * Convert sheet timestamps to YYYY-MM-DD in the configured timezone.
 */
export function toIncassoDate(isoLike) {
  if (!isoLike) {
    throw new Error("Missing date value");
  }

  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${isoLike}`);
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.corrispettivi.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parseIsoDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Expected YYYY-MM-DD, got: ${value}`);
  }
  return value;
}

export function isWithinRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function sortDatesAsc(dates) {
  return [...dates].sort((a, b) => a.localeCompare(b));
}

/**
 * Convert sheet timestamps to YYYY-MM in the configured timezone.
 */
export function toYearMonth(isoLike) {
  if (!isoLike) {
    throw new Error("Missing date value");
  }

  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${isoLike}`);
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.corrispettivi.timezone,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export function isSameYearMonth(isoLike, yearMonth) {
  return toYearMonth(isoLike) === yearMonth;
}
