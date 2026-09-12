import { format, isValid, parseISO } from 'date-fns';

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');

export function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
}

export function displayDate(value: Date | string) {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'MMM d, yyyy');
}

export function displayShortDate(value: Date | string) {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'MMM d');
}
