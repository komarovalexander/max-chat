import { useEffect, useRef, useState } from 'react';
import { deleteNotification, GreenApiError, receiveNotification, type Credentials } from '../api/greenApi';
import { parseNotification, type NotificationEvent } from '../lib/notifications';

export type ConnectionState = { status: 'connecting' | 'online' } | { status: 'error'; message: string };

const RECEIVE_TIMEOUT_SEC = 5;
const MAX_BACKOFF_MS = 30_000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Получение входящих уведомлений по технологии HTTP API:
 * ReceiveNotification (long polling до 5 с) → обработка → DeleteNotification.
 * https://green-api.com/v3/docs/api/receiving/technology-http-api/
 */
export function useNotificationPolling(
  creds: Credentials | null,
  onEvent: (event: NotificationEvent) => void,
): ConnectionState {
  const [connection, setConnection] = useState<ConnectionState>({ status: 'connecting' });
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!creds) return;
    const controller = new AbortController();
    const { signal } = controller;
    setConnection({ status: 'connecting' });

    (async () => {
      let backoff = 0;
      while (!signal.aborted) {
        try {
          const notification = await receiveNotification(creds, RECEIVE_TIMEOUT_SEC, signal);
          if (signal.aborted) break;
          setConnection((prev) => (prev.status === 'online' ? prev : { status: 'online' }));
          backoff = 0;
          if (!notification) continue;

          try {
            handlerRef.current(parseNotification(notification.body));
          } catch (error) {
            console.error('Ошибка обработки уведомления', error, notification);
          }
          // Удаляем уведомление из очереди в любом случае, иначе очередь «застрянет» на нём.
          // Если удаление не удалось, уведомление придёт повторно — дубли отсекаются по idMessage.
          await deleteNotification(creds, notification.receiptId).catch((error) =>
            console.warn('Не удалось удалить уведомление', notification.receiptId, error),
          );
        } catch (error) {
          if (signal.aborted) break;
          const message = error instanceof GreenApiError ? error.message : 'Ошибка получения сообщений';
          setConnection({ status: 'error', message });
          backoff = Math.min(backoff ? backoff * 2 : 2_000, MAX_BACKOFF_MS);
          await sleep(backoff, signal);
        }
      }
    })();

    return () => controller.abort();
  }, [creds]);

  return connection;
}
