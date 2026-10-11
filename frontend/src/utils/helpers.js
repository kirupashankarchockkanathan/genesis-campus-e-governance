import { TODAY } from '../data/mockData';

export const pad = (n) => String(n).padStart(2, '0');

export function parseEventDate(e) {
  const [y, m, d] = e.date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysUntil(e) {
  const d = parseEventDate(e);
  const t = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  return Math.round((d - t) / 86400000);
}

export function monthShort(e) {
  return parseEventDate(e).toLocaleString('en-GB', { month: 'short' }).toUpperCase();
}

export function dayOf(e) {
  return parseEventDate(e).getDate();
}

export function fullDate(e) {
  return parseEventDate(e).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function greeting() {
  const h = TODAY.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** First name without honorifics: "Dr. Meera Nair" -> "Meera". */
export const firstName = (name = '') =>
  name.split(' ').find((w) => !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w)) || name;
