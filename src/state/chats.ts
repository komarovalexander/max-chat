import { formatPhone } from '../lib/phone';
import type { Chat, ChatMessage, MessageStatus } from '../types';

/** Сколько сообщений храним в одном чате (ограничение для localStorage). */
export const MAX_MESSAGES_PER_CHAT = 500;

export type ChatsState = Chat[];

export type ChatsAction =
  | { type: 'chatCreated'; chat: Chat }
  | {
      type: 'messageReceived';
      chatId: string;
      chatName?: string;
      phone?: string;
      isGroup?: boolean;
      message: ChatMessage;
      /** Ключ открытого чата — для подсчёта непрочитанных. */
      activeKey: string | null;
    }
  | { type: 'messageQueued'; chatKey: string; message: ChatMessage }
  | { type: 'messageSent'; chatKey: string; localId: string; idMessage: string }
  | { type: 'messageFailed'; chatKey: string; localId: string; error: string }
  | { type: 'messageRetry'; chatKey: string; localId: string }
  | { type: 'statusUpdated'; chatId: string; idMessage: string; status: MessageStatus }
  | { type: 'chatRead'; chatKey: string }
  | { type: 'chatRemoved'; chatKey: string }
  | { type: 'replaced'; chats: ChatsState };

const STATUS_RANK: Record<MessageStatus, number> = { failed: 0, pending: 1, sent: 2, delivered: 3, read: 4 };

let keyCounter = 0;
export function newKey(prefix = 'chat'): string {
  keyCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${keyCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function phoneChatId(phone: string): string {
  return `${phone}@c.us`;
}

/** Ищет чат по chatId, а если не нашли — по номеру телефона (чат, созданный как 7999…@c.us). */
export function findChat(chats: ChatsState, chatId: string, phone?: string): Chat | undefined {
  return (
    chats.find((c) => c.chatId === chatId) ??
    (phone ? chats.find((c) => c.phone === phone || c.chatId === phoneChatId(phone)) : undefined)
  );
}

function isPlaceholderTitle(chat: Chat): boolean {
  return (
    chat.title === chat.chatId ||
    (chat.phone !== undefined && (chat.title === chat.phone || chat.title === formatPhone(chat.phone)))
  );
}

export function lastActivity(chat: Chat): number {
  const last = chat.messages[chat.messages.length - 1];
  return last ? last.timestamp : chat.createdAt;
}

export function sortChats(chats: ChatsState): ChatsState {
  return [...chats].sort((a, b) => lastActivity(b) - lastActivity(a));
}

function updateChat(chats: ChatsState, key: string, fn: (chat: Chat) => Chat): ChatsState {
  return chats.map((c) => (c.key === key ? fn(c) : c));
}

function insertMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  let message = incoming;
  // Сервер присылает время с точностью до секунды, а локальные сообщения — в миллисекундах.
  // Чтобы свежий ответ не «прыгал» выше нашего сообщения из той же секунды, ставим его в конец.
  const last = messages[messages.length - 1];
  if (last && message.timestamp < last.timestamp && last.timestamp - message.timestamp < 1000) {
    message = { ...message, timestamp: last.timestamp };
  }
  const next = [...messages, message].sort((a, b) => a.timestamp - b.timestamp);
  return next.length > MAX_MESSAGES_PER_CHAT ? next.slice(next.length - MAX_MESSAGES_PER_CHAT) : next;
}

export function chatsReducer(state: ChatsState, action: ChatsAction): ChatsState {
  switch (action.type) {
    case 'chatCreated': {
      const existing = findChat(state, action.chat.chatId, action.chat.phone);
      if (existing) return state;
      return [action.chat, ...state];
    }

    case 'messageReceived': {
      const { chatId, chatName, phone, isGroup, message, activeKey } = action;
      const existing = findChat(state, chatId, phone);

      if (!existing) {
        const chat: Chat = {
          key: newKey(),
          chatId,
          phone,
          title: chatName || (phone ? formatPhone(phone) : chatId),
          isGroup,
          messages: [message],
          unread: message.direction === 'in' ? 1 : 0,
          createdAt: message.timestamp,
        };
        return [chat, ...state];
      }

      // Уже есть такое сообщение (повторная доставка или наше же отправленное через API).
      if (existing.messages.some((m) => m.id === message.id)) {
        return updateChat(state, existing.key, (c) => ({ ...c, chatId }));
      }

      return updateChat(state, existing.key, (c) => ({
        ...c,
        // Чат мог быть создан по номеру (7999…@c.us) — запоминаем настоящий chatId от сервера.
        chatId,
        phone: c.phone ?? phone,
        // Заголовок-заглушку (номер или id) заменяем на имя из MAX.
        title: isPlaceholderTitle(c) ? chatName || c.title : c.title,
        messages: insertMessage(c.messages, message),
        unread: message.direction === 'in' && c.key !== activeKey ? c.unread + 1 : c.unread,
      }));
    }

    case 'messageQueued':
      return updateChat(state, action.chatKey, (c) => ({ ...c, messages: insertMessage(c.messages, action.message) }));

    case 'messageSent':
      return updateChat(state, action.chatKey, (c) => {
        // Уведомление outgoingAPIMessageReceived могло прийти раньше ответа sendMessage.
        if (c.messages.some((m) => m.id === action.idMessage)) {
          return { ...c, messages: c.messages.filter((m) => m.id !== action.localId) };
        }
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === action.localId ? { ...m, id: action.idMessage, status: 'sent', error: undefined } : m,
          ),
        };
      });

    case 'messageFailed':
      return updateChat(state, action.chatKey, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === action.localId ? { ...m, status: 'failed', error: action.error } : m)),
      }));

    case 'messageRetry':
      return updateChat(state, action.chatKey, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === action.localId ? { ...m, status: 'pending', error: undefined, timestamp: Date.now() } : m,
        ),
      }));

    case 'statusUpdated': {
      const chat = state.find((c) => c.chatId === action.chatId || c.messages.some((m) => m.id === action.idMessage));
      if (!chat) return state;
      return updateChat(state, chat.key, (c) => ({
        ...c,
        messages: c.messages.map((m) => {
          if (m.id !== action.idMessage || m.direction !== 'out') return m;
          const current = m.status ?? 'sent';
          const better = action.status === 'failed' || STATUS_RANK[action.status] > STATUS_RANK[current];
          return better ? { ...m, status: action.status } : m;
        }),
      }));
    }

    case 'chatRead':
      return updateChat(state, action.chatKey, (c) => (c.unread ? { ...c, unread: 0 } : c));

    case 'chatRemoved':
      return state.filter((c) => c.key !== action.chatKey);

    case 'replaced':
      return action.chats;

    default:
      return state;
  }
}
