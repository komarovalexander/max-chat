import type { ChatMessage, MessageStatus } from '../types';

/**
 * Разбор входящих уведомлений GREEN-API в события приложения.
 * Формат: https://green-api.com/v3/docs/api/receiving/notifications-format/
 */

export type NotificationEvent =
  | {
      kind: 'message';
      chatId: string;
      chatName?: string;
      phone?: string;
      isGroup: boolean;
      message: ChatMessage;
    }
  | { kind: 'status'; chatId: string; idMessage: string; status: MessageStatus }
  | { kind: 'state'; state: string }
  | { kind: 'ignored'; typeWebhook: string };

const MESSAGE_WEBHOOKS: Record<string, 'in' | 'out'> = {
  incomingMessageReceived: 'in',
  outgoingMessageReceived: 'out', // отправлено с телефона
  outgoingAPIMessageReceived: 'out', // отправлено через API (в т.ч. этим интерфейсом)
};

const UNSUPPORTED_LABELS: Record<string, string> = {
  imageMessage: 'Изображение',
  videoMessage: 'Видео',
  documentMessage: 'Документ',
  audioMessage: 'Аудио',
  locationMessage: 'Геолокация',
  contactMessage: 'Контакт',
  pollMessage: 'Опрос',
  stickerMessage: 'Стикер',
  reactionMessage: 'Реакция',
};

type Obj = Record<string, unknown>;

const asObj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const asStr = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;

/** Достаёт текст из messageData. Возвращает null для нетекстовых сообщений. */
export function extractText(messageData: unknown): string | null {
  const md = asObj(messageData);
  switch (md.typeMessage) {
    case 'textMessage':
      return asStr(asObj(md.textMessageData).textMessage) ?? '';
    case 'extendedTextMessage':
    case 'quotedMessage':
      return asStr(asObj(md.extendedTextMessageData).text) ?? asStr(asObj(md.textMessageData).textMessage) ?? '';
    default:
      return null;
  }
}

function toStatus(raw: unknown): MessageStatus | null {
  switch (raw) {
    case 'sent':
    case 'delivered':
    case 'read':
    case 'failed':
      return raw;
    case 'noAccount':
    case 'notInGroup':
      return 'failed';
    default:
      return null;
  }
}

export function parseNotification(body: unknown): NotificationEvent {
  const b = asObj(body);
  const typeWebhook = asStr(b.typeWebhook) ?? 'unknown';

  const direction = MESSAGE_WEBHOOKS[typeWebhook];
  if (direction) {
    const sender = asObj(b.senderData);
    const chatId = asStr(sender.chatId);
    const idMessage = asStr(b.idMessage);
    if (!chatId || !idMessage) return { kind: 'ignored', typeWebhook };

    const md = asObj(b.messageData);
    const text = extractText(md);
    const typeMessage = asStr(md.typeMessage) ?? 'unknown';
    const isGroup = sender.chatType === 'group' || chatId.startsWith('-');
    const phoneRaw = asStr(sender.senderPhoneNumber);
    // Для исходящих senderPhoneNumber — номер получателя только в личном чате.
    const phone = !isGroup && phoneRaw && phoneRaw !== '0' ? phoneRaw : undefined;
    const timestampSec = typeof b.timestamp === 'number' ? b.timestamp : Date.now() / 1000;

    const message: ChatMessage = {
      id: idMessage,
      direction,
      timestamp: Math.round(timestampSec * 1000),
      text: text ?? `${UNSUPPORTED_LABELS[typeMessage] ?? 'Сообщение'} — этот тип не поддерживается`,
    };
    if (text === null) message.unsupported = true;
    if (direction === 'out') message.status = 'sent';
    const senderName = asStr(sender.senderName);
    if (isGroup && direction === 'in' && senderName) message.senderName = senderName;

    return {
      kind: 'message',
      chatId,
      chatName: asStr(sender.chatName) || undefined,
      phone,
      isGroup,
      message,
    };
  }

  if (typeWebhook === 'outgoingMessageStatus') {
    const chatId = asStr(b.chatId);
    const idMessage = asStr(b.idMessage);
    const status = toStatus(b.status);
    if (chatId && idMessage && status) return { kind: 'status', chatId, idMessage, status };
    return { kind: 'ignored', typeWebhook };
  }

  if (typeWebhook === 'stateInstanceChanged') {
    return { kind: 'state', state: asStr(b.stateInstance) ?? 'unknown' };
  }

  return { kind: 'ignored', typeWebhook };
}
