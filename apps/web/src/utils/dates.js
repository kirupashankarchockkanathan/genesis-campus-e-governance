import { format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

// All timestamps are UTC in the API; they are shown in the configured time zone (D16, NFR-05).
export const APP_TIMEZONE = import.meta.env?.VITE_APP_TIMEZONE || 'Asia/Kolkata';

const inZone = (iso) => toZonedTime(new Date(iso), APP_TIMEZONE);

export const fmtDate = (iso) => (iso ? format(inZone(iso), 'd MMM yyyy') : '');
export const fmtTime = (iso) => (iso ? format(inZone(iso), 'HH:mm') : '');
export const fmtDateTime = (iso) => (iso ? format(inZone(iso), 'd MMM yyyy, HH:mm') : '');
export const fmtRange = (start, end) => {
  if (!start) return '';
  const sameDay = dayKey(start) === dayKey(end);
  return sameDay
    ? `${fmtDate(start)}, ${fmtTime(start)} to ${fmtTime(end)}`
    : `${fmtDateTime(start)} to ${fmtDateTime(end)}`;
};

/** yyyy-MM-dd of the local day, used to place calendar items on the correct day (TC-CAL-06). */
export const dayKey = (iso) => format(inZone(iso), 'yyyy-MM-dd');

/** <input type="datetime-local"> value for an ISO instant, in the portal time zone. */
export const toInputValue = (iso) => (iso ? format(inZone(iso), "yyyy-MM-dd'T'HH:mm") : '');
/** The reverse: a datetime-local value typed in the portal time zone becomes a UTC ISO string. */
export const fromInputValue = (value) =>
  value ? fromZonedTime(value, APP_TIMEZONE).toISOString() : undefined;

export const monthRange = (year, month) => ({
  from: fromZonedTime(new Date(year, month, 1, 0, 0, 0), APP_TIMEZONE).toISOString(),
  to: fromZonedTime(new Date(year, month + 1, 0, 23, 59, 59), APP_TIMEZONE).toISOString(),
});

export const todayLocalKey = () => dayKey(new Date().toISOString());
