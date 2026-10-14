import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { formatDayLabel, formatTime, isSameDay } from '../lib/format';
import { formatPhone } from '../lib/phone';
import type { Chat, ChatMessage } from '../types';
import { Avatar } from './Avatar';
import { AlertIcon, BackIcon, ClockIcon, SendIcon, TicksIcon, TrashIcon } from './icons';

const MAX_LENGTH = 4000;

interface ChatWindowProps {
  chat: Chat;
  onSend: (text: string) => void;
  onRetry: (message: ChatMessage) => void;
  onBack: () => void;
  onDelete: () => void;
}

function StatusMark({ message, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  switch (message.status) {
    case 'pending':
      return (
        <span className="status pending" title="Отправляется" role="img" aria-label="Отправляется">
          <ClockIcon />
        </span>
      );
    case 'failed':
      return (
        <button className="status failed" onClick={onRetry} title={`${message.error ?? 'Не отправлено'}. Нажмите, чтобы повторить`}>
          <AlertIcon />
          <span>Повторить</span>
        </button>
      );
    case 'read':
      return (
        <span className="status read" title="Прочитано" role="img" aria-label="Прочитано">
          <TicksIcon double />
        </span>
      );
    case 'delivered':
      return (
        <span className="status" title="Доставлено" role="img" aria-label="Доставлено">
          <TicksIcon double />
        </span>
      );
    default:
      return (
        <span className="status" title="Отправлено" role="img" aria-label="Отправлено">
          <TicksIcon />
        </span>
      );
  }
}

export function ChatWindow({ chat, onSend, onRetry, onBack, onDelete }: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  // Новый чат — сбрасываем черновик и фокусируем поле ввода.
  useEffect(() => {
    setDraft('');
    stickToBottom.current = true;
    inputRef.current?.focus();
  }, [chat.key]);

  // Прокрутка вниз при новых сообщениях, если пользователь не листает историю.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, chat.key]);

  // Авто-высота поля ввода.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const text = draft.trim();
  const tooLong = draft.length > MAX_LENGTH;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text || tooLong) return;
    stickToBottom.current = true;
    onSend(text);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const subtitle = chat.isGroup ? 'группа' : chat.phone ? formatPhone(chat.phone) : `ID ${chat.chatId}`;

  return (
    <section className="chat" aria-label={`Чат с ${chat.title}`}>
      <header className="chat-header">
        <button className="icon-button back-button" onClick={onBack} aria-label="К списку чатов">
          <BackIcon />
        </button>
        <Avatar title={chat.title} seed={chat.chatId} size={40} />
        <div className="chat-header-text">
          <h2>{chat.title}</h2>
          <span>{subtitle}</span>
        </div>
        <button
          className="icon-button"
          onClick={() => {
            if (confirm('Удалить чат из списка? Переписка в MAX не изменится.')) onDelete();
          }}
          aria-label="Удалить чат из списка"
          title="Удалить чат из списка"
        >
          <TrashIcon />
        </button>
      </header>

      <div
        className="messages"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {chat.messages.length === 0 && (
          <div className="messages-empty">
            <p>Сообщений пока нет</p>
            <span>Напишите первое сообщение — ответ появится здесь автоматически.</span>
          </div>
        )}
        {chat.messages.map((message, index) => {
          const prev = chat.messages[index - 1];
          const newDay = !prev || !isSameDay(prev.timestamp, message.timestamp);
          const grouped = !newDay && prev && prev.direction === message.direction && message.timestamp - prev.timestamp < 120_000;
          return (
            <Fragment key={message.id}>
              {newDay && (
                <div className="day-separator">
                  <span>{formatDayLabel(message.timestamp)}</span>
                </div>
              )}
              <div className={`bubble-row ${message.direction}${grouped ? ' grouped' : ''}`}>
                <div className={`bubble${message.unsupported ? ' unsupported' : ''}${message.status === 'failed' ? ' failed' : ''}`}>
                  {message.senderName && <div className="bubble-sender">{message.senderName}</div>}
                  <span className="bubble-text">{message.text}</span>
                  <span className="bubble-meta">
                    <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
                    {message.direction === 'out' && <StatusMark message={message} onRetry={() => onRetry(message)} />}
                  </span>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          ref={inputRef}
          rows={1}
          placeholder="Сообщение"
          aria-label="Текст сообщения"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {draft.length > MAX_LENGTH - 200 && (
          <span className={`counter${tooLong ? ' over' : ''}`}>
            {draft.length}/{MAX_LENGTH}
          </span>
        )}
        <button type="submit" className="send-button" disabled={!text || tooLong} aria-label="Отправить">
          <SendIcon />
        </button>
      </form>
    </section>
  );
}
