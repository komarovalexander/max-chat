import { describe, expect, it } from 'vitest';
import { parseNotification } from './notifications';

const sender = {
  chatId: '10000000',
  chatName: 'Иван',
  chatType: 'user',
  sender: '10000000',
  senderName: 'Иван',
  senderType: 'user',
  senderPhoneNumber: 79876543210,
};

describe('parseNotification', () => {
  it('разбирает входящее текстовое сообщение', () => {
    const event = parseNotification({
      typeWebhook: 'incomingMessageReceived',
      timestamp: 1763115112,
      idMessage: '1763115112345',
      senderData: sender,
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет!' } },
    });
    expect(event).toEqual({
      kind: 'message',
      chatId: '10000000',
      chatName: 'Иван',
      phone: '79876543210',
      isGroup: false,
      message: { id: '1763115112345', direction: 'in', timestamp: 1763115112000, text: 'Привет!' },
    });
  });

  it('берёт текст из extendedTextMessage', () => {
    const event = parseNotification({
      typeWebhook: 'incomingMessageReceived',
      timestamp: 1,
      idMessage: 'x',
      senderData: sender,
      messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'https://max.ru' } },
    });
    expect(event.kind === 'message' && event.message.text).toBe('https://max.ru');
  });

  it('помечает нетекстовые сообщения как неподдерживаемые', () => {
    const event = parseNotification({
      typeWebhook: 'incomingMessageReceived',
      timestamp: 1,
      idMessage: 'img',
      senderData: sender,
      messageData: { typeMessage: 'imageMessage', fileMessageData: {} },
    });
    expect(event.kind).toBe('message');
    if (event.kind === 'message') {
      expect(event.message.unsupported).toBe(true);
      expect(event.message.text).toContain('Изображение');
    }
  });

  it('сообщения, отправленные с телефона и через API, считаются исходящими', () => {
    for (const typeWebhook of ['outgoingMessageReceived', 'outgoingAPIMessageReceived']) {
      const event = parseNotification({
        typeWebhook,
        timestamp: 1,
        idMessage: 'out-1',
        senderData: sender,
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'ок' } },
      });
      expect(event.kind === 'message' && event.message.direction).toBe('out');
      expect(event.kind === 'message' && event.message.status).toBe('sent');
    }
  });

  it('разбирает статус исходящего сообщения', () => {
    expect(
      parseNotification({ typeWebhook: 'outgoingMessageStatus', chatId: '1', idMessage: 'm', status: 'read' }),
    ).toEqual({ kind: 'status', chatId: '1', idMessage: 'm', status: 'read' });
  });

  it('игнорирует прочие уведомления', () => {
    expect(parseNotification({ typeWebhook: 'incomingCall' })).toEqual({ kind: 'ignored', typeWebhook: 'incomingCall' });
    expect(parseNotification(null)).toEqual({ kind: 'ignored', typeWebhook: 'unknown' });
  });
});
