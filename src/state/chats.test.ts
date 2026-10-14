import { describe, expect, it } from 'vitest';
import type { Chat, ChatMessage } from '../types';
import { chatsReducer } from './chats';

const chat = (over: Partial<Chat> = {}): Chat => ({
  key: 'k1',
  chatId: '79991234567@c.us',
  phone: '79991234567',
  title: '+7 999 123-45-67',
  messages: [],
  unread: 0,
  createdAt: 0,
  ...over,
});

const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  text: 'Привет',
  direction: 'in',
  timestamp: 1000,
  ...over,
});

describe('chatsReducer', () => {
  it('сопоставляет ответ с чатом, созданным по номеру, и запоминает настоящий chatId', () => {
    const state = chatsReducer([chat()], {
      type: 'messageReceived',
      chatId: '10000000',
      chatName: 'Иван',
      phone: '79991234567',
      message: msg(),
      activeKey: null,
    });
    expect(state).toHaveLength(1);
    expect(state[0].chatId).toBe('10000000');
    expect(state[0].title).toBe('Иван');
    expect(state[0].unread).toBe(1);
  });

  it('не увеличивает непрочитанные для открытого чата и не дублирует сообщения', () => {
    let state = chatsReducer([chat({ chatId: '10000000' })], {
      type: 'messageReceived',
      chatId: '10000000',
      message: msg(),
      activeKey: 'k1',
    });
    state = chatsReducer(state, { type: 'messageReceived', chatId: '10000000', message: msg(), activeKey: 'k1' });
    expect(state[0].messages).toHaveLength(1);
    expect(state[0].unread).toBe(0);
  });

  it('создаёт новый чат для сообщения от неизвестного отправителя', () => {
    const state = chatsReducer([], {
      type: 'messageReceived',
      chatId: '555',
      chatName: 'Пётр',
      message: msg(),
      activeKey: null,
    });
    expect(state[0]).toMatchObject({ chatId: '555', title: 'Пётр', unread: 1 });
  });

  it('заменяет локальный id на idMessage после отправки и обновляет статусы только вперёд', () => {
    let state = chatsReducer([chat({ chatId: '10000000' })], {
      type: 'messageQueued',
      chatKey: 'k1',
      message: msg({ id: 'local-1', direction: 'out', status: 'pending' }),
    });
    state = chatsReducer(state, { type: 'messageSent', chatKey: 'k1', localId: 'local-1', idMessage: 'srv-1' });
    expect(state[0].messages[0]).toMatchObject({ id: 'srv-1', status: 'sent' });

    state = chatsReducer(state, { type: 'statusUpdated', chatId: '10000000', idMessage: 'srv-1', status: 'read' });
    state = chatsReducer(state, { type: 'statusUpdated', chatId: '10000000', idMessage: 'srv-1', status: 'delivered' });
    expect(state[0].messages[0].status).toBe('read');
  });

  it('убирает локальную копию, если уведомление об отправке пришло раньше ответа API', () => {
    let state = chatsReducer([chat({ chatId: '10000000' })], {
      type: 'messageQueued',
      chatKey: 'k1',
      message: msg({ id: 'local-1', direction: 'out', status: 'pending' }),
    });
    state = chatsReducer(state, {
      type: 'messageReceived',
      chatId: '10000000',
      message: msg({ id: 'srv-1', direction: 'out', status: 'sent', timestamp: 1001 }),
      activeKey: 'k1',
    });
    state = chatsReducer(state, { type: 'messageSent', chatKey: 'k1', localId: 'local-1', idMessage: 'srv-1' });
    expect(state[0].messages.map((m) => m.id)).toEqual(['srv-1']);
  });
});
