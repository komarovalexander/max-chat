const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dateYearFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function formatTime(ts: number): string {
  return timeFmt.format(ts);
}

/** Время в списке чатов: сегодня — часы, на этой неделе — день недели, иначе дата. */
export function formatListTime(ts: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000);
  if (days <= 0) return timeFmt.format(ts);
  if (days === 1) return 'вчера';
  if (days < 7) return weekdayFmt.format(ts);
  return shortDateFmt.format(ts);
}

/** Разделитель дат в ленте сообщений. */
export function formatDayLabel(ts: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000);
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  return new Date(ts).getFullYear() === new Date(now).getFullYear() ? dateFmt.format(ts) : dateYearFmt.format(ts);
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function initials(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (/^\d+$/.test(words.join(''))) return '#';
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
}

const AVATAR_COLORS = ['#ff7a59', '#f5a623', '#3dbb74', '#26a6d1', '#5b7cfa', '#9b6cf0', '#e05c9a', '#13b5a6'];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
