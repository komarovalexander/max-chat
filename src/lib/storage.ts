import type { Credentials } from '../api/greenApi';
import type { Chat } from '../types';

const CREDS_KEY = 'max-chat:credentials';
const chatsKey = (idInstance: string) => `max-chat:chats:${idInstance}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* хранилище недоступно или переполнено — работаем без него */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadCredentials(): Credentials | null {
  const c = read<Credentials>(CREDS_KEY);
  return c && c.idInstance && c.apiTokenInstance && c.apiUrl ? c : null;
}

export function saveCredentials(creds: Credentials): void {
  write(CREDS_KEY, creds);
}

export function clearCredentials(): void {
  remove(CREDS_KEY);
}

export function loadChats(idInstance: string): Chat[] {
  const chats = read<Chat[]>(chatsKey(idInstance));
  if (!Array.isArray(chats)) return [];
  // Сообщения, «зависшие» в отправке при закрытии вкладки, помечаем ошибкой.
  return chats.map((c) => ({
    ...c,
    messages: c.messages.map((m) =>
      m.status === 'pending' ? { ...m, status: 'failed' as const, error: 'Отправка прервана' } : m,
    ),
  }));
}

export function saveChats(idInstance: string, chats: Chat[]): void {
  write(chatsKey(idInstance), chats);
}
