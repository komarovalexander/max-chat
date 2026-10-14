/**
 * Минимальный клиент GREEN-API для мессенджера MAX (API v3).
 * Формат адреса: {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}
 * Документация: https://green-api.com/v3/docs/
 */

export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export type InstanceState =
  | 'authorized'
  | 'notAuthorized'
  | 'starting'
  | 'blocked'
  | 'sleepMode'
  | 'yellowCard'
  | string;

export interface InstanceSettings {
  webhookUrl?: string;
  incomingWebhook?: string;
  outgoingWebhook?: string;
  outgoingMessageWebhook?: string;
  outgoingAPIMessageWebhook?: string;
  stateWebhook?: string;
  [key: string]: unknown;
}

export interface RawNotification {
  receiptId: number;
  body: Record<string, unknown>;
}

export class GreenApiError extends Error {
  readonly status: number;
  readonly responseText: string;

  constructor(message: string, status: number, responseText = '') {
    super(message);
    this.name = 'GreenApiError';
    this.status = status;
    this.responseText = responseText;
  }
}

/** Хост API по умолчанию: первые 4 цифры idInstance, например 3100 → https://3100.api.green-api.com */
export function defaultApiUrl(idInstance: string): string {
  const digits = idInstance.replace(/\D/g, '');
  return digits.length >= 4
    ? `https://${digits.slice(0, 4)}.api.green-api.com`
    : 'https://api.green-api.com';
}

export function normalizeApiUrl(apiUrl: string): string {
  let url = apiUrl.trim().replace(/\/+$/, '');
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  // Префикс /v3 необязателен — убираем, чтобы не получить /v3/v3.
  return url.replace(/\/v3$/i, '');
}

function buildUrl(creds: Credentials, method: string, suffix = ''): string {
  const base = normalizeApiUrl(creds.apiUrl);
  return `${base}/waInstance${encodeURIComponent(creds.idInstance.trim())}/${method}/${encodeURIComponent(
    creds.apiTokenInstance.trim(),
  )}${suffix}`;
}

function describeHttpError(status: number, text: string): string {
  let reason = text;
  try {
    const parsed = JSON.parse(text) as { message?: string; reason?: string; error?: string };
    reason = parsed.message || parsed.reason || parsed.error || text;
  } catch {
    /* ответ не JSON */
  }

  if (/custom webhook url is set/i.test(reason)) {
    return 'В настройках инстанса задан webhookUrl — получение через HTTP API недоступно. Очистите webhookUrl в личном кабинете.';
  }
  switch (status) {
    case 401:
      return 'Неверный apiTokenInstance.';
    case 403:
      return 'Доступ запрещён: проверьте idInstance и хост API (apiUrl).';
    case 404:
      return 'Метод не найден: проверьте хост API (apiUrl).';
    case 429:
      return 'Слишком много запросов. Подождите немного и повторите.';
    case 466:
      return 'Исчерпан лимит запросов на тарифе инстанса.';
    case 469:
      return 'MAX ограничил проверку номеров из-за частых запросов. Повторите позже.';
    default:
      if (/not authorized/i.test(reason)) return 'Инстанс не авторизован в MAX. Отсканируйте QR-код в личном кабинете GREEN-API.';
      return reason ? `Ошибка API (${status}): ${reason}` : `Ошибка API (HTTP ${status}).`;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  suffix?: string;
  signal?: AbortSignal;
}

async function request<T>(creds: Credentials, apiMethod: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, suffix, signal } = options;
  let response: Response;
  try {
    response = await fetch(buildUrl(creds, apiMethod, suffix), {
      method,
      signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new GreenApiError('Не удалось связаться с GREEN-API. Проверьте подключение к интернету и хост API.', 0);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new GreenApiError(describeHttpError(response.status, text), response.status, text);
  }
  if (!text.trim()) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GreenApiError('GREEN-API вернул некорректный ответ.', response.status, text);
  }
}

export async function getStateInstance(creds: Credentials, signal?: AbortSignal): Promise<InstanceState> {
  const res = await request<{ stateInstance?: InstanceState }>(creds, 'getStateInstance', { signal });
  if (!res?.stateInstance) throw new GreenApiError('Не удалось получить состояние инстанса.', 200);
  return res.stateInstance;
}

export function getSettings(creds: Credentials): Promise<InstanceSettings> {
  return request<InstanceSettings>(creds, 'getSettings');
}

export function setSettings(creds: Credentials, settings: Partial<InstanceSettings>): Promise<{ saveSettings: boolean }> {
  return request(creds, 'setSettings', { method: 'POST', body: settings });
}

/** Возвращает chatId пользователя MAX по номеру телефона или null, если аккаунта нет. */
export async function checkAccount(creds: Credentials, phoneNumber: string): Promise<string | null> {
  const res = await request<{ exist?: boolean; chatId?: string; status?: boolean; reason?: string }>(
    creds,
    'checkAccount',
    { method: 'POST', body: { phoneNumber: Number(phoneNumber) } },
  );
  if (res && res.status === false) {
    throw new GreenApiError(describeHttpError(400, res.reason ?? ''), 400, JSON.stringify(res));
  }
  if (!res?.exist || !res.chatId) return null;
  return String(res.chatId);
}

export async function sendMessage(creds: Credentials, chatId: string, message: string): Promise<string> {
  const res = await request<{ idMessage?: string }>(creds, 'sendMessage', {
    method: 'POST',
    body: { chatId, message },
  });
  if (!res?.idMessage) throw new GreenApiError('GREEN-API не вернул идентификатор сообщения.', 200);
  return String(res.idMessage);
}

/** Ждёт одно уведомление до `timeoutSec` секунд (5–60). Возвращает null, если очередь пуста. */
export async function receiveNotification(
  creds: Credentials,
  timeoutSec = 5,
  signal?: AbortSignal,
): Promise<RawNotification | null> {
  const res = await request<RawNotification | null>(creds, 'receiveNotification', {
    suffix: `?receiveTimeout=${Math.min(60, Math.max(5, timeoutSec))}`,
    signal,
  });
  if (!res || typeof res.receiptId !== 'number') return null;
  return res;
}

export async function deleteNotification(creds: Credentials, receiptId: number): Promise<boolean> {
  const res = await request<{ result?: boolean }>(creds, 'deleteNotification', {
    method: 'DELETE',
    suffix: `/${receiptId}`,
  });
  return Boolean(res?.result);
}
