export type MessageDirection = 'in' | 'out';

/** pending — отправляется; sent/delivered/read — статусы MAX; failed — ошибка отправки. */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatMessage {
  /** idMessage из GREEN-API, либо локальный id (local-…) пока сообщение не отправлено. */
  id: string;
  text: string;
  direction: MessageDirection;
  /** Время в миллисекундах. */
  timestamp: number;
  status?: MessageStatus;
  error?: string;
  /** Сообщение не текстовое — показываем заглушку. */
  unsupported?: boolean;
  senderName?: string;
}

export interface Chat {
  /** Стабильный локальный ключ (не меняется, даже если сменился chatId). */
  key: string;
  /** Идентификатор чата GREEN-API: число строкой или 79991234567@c.us. */
  chatId: string;
  /** Номер телефона, если чат создан по номеру или пришёл в уведомлении. */
  phone?: string;
  title: string;
  isGroup?: boolean;
  messages: ChatMessage[];
  unread: number;
  createdAt: number;
}
