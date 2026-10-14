import { useState, type FormEvent } from 'react';
import type { ConnectionState } from '../hooks/useNotificationPolling';
import { formatListTime } from '../lib/format';
import { formatPhone, normalizePhone } from '../lib/phone';
import { lastActivity } from '../state/chats';
import type { Chat } from '../types';
import { Avatar } from './Avatar';
import { LogoutIcon, PlusIcon } from './icons';

interface SidebarProps {
  chats: Chat[];
  activeKey: string | null;
  idInstance: string;
  connection: ConnectionState;
  settingsWarning: string | null;
  onFixSettings: () => void;
  fixingSettings: boolean;
  onSelect: (key: string) => void;
  onCreateChat: (phone: string) => Promise<string | null>;
  onLogout: () => void;
}

const CONNECTION_LABEL: Record<ConnectionState['status'], string> = {
  connecting: 'подключение…',
  online: 'в сети',
  error: 'нет связи',
};

export function Sidebar({
  chats,
  activeKey,
  idInstance,
  connection,
  settingsWarning,
  onFixSettings,
  fixingSettings,
  onSelect,
  onCreateChat,
  onLogout,
}: SidebarProps) {
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError('Введите номер в международном формате, например +7 999 123-45-67');
      return;
    }
    setCreating(true);
    setError(null);
    const problem = await onCreateChat(normalized);
    setCreating(false);
    if (problem) setError(problem);
    else setPhone('');
  };

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-title">
          <h2>Чаты</h2>
          <span
            className={`connection connection-${connection.status}`}
            title={connection.status === 'error' ? connection.message : `Инстанс ${idInstance}`}
          >
            <i aria-hidden />
            {CONNECTION_LABEL[connection.status]}
          </span>
        </div>
        <button className="icon-button" onClick={onLogout} aria-label="Выйти" title="Выйти">
          <LogoutIcon />
        </button>
      </header>

      <form className="new-chat" onSubmit={submit}>
        <input
          type="tel"
          inputMode="tel"
          placeholder="Номер получателя, +7…"
          aria-label="Номер телефона получателя"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className="round-button" disabled={creating || !phone.trim()} aria-label="Создать чат" title="Создать чат">
          {creating ? <span className="spinner" aria-hidden /> : <PlusIcon />}
        </button>
      </form>
      {error && (
        <div className="sidebar-error" role="alert">
          {error}
        </div>
      )}

      {connection.status === 'error' && <div className="sidebar-warning">{connection.message}</div>}
      {settingsWarning && (
        <div className="sidebar-warning">
          {settingsWarning}{' '}
          <button className="link-button inline" onClick={onFixSettings} disabled={fixingSettings}>
            {fixingSettings ? 'Сохраняем…' : 'Включить'}
          </button>
        </div>
      )}

      <nav className="chat-list" aria-label="Список чатов">
        {chats.length === 0 && (
          <p className="chat-list-empty">Чатов пока нет. Введите номер получателя выше, чтобы начать переписку.</p>
        )}
        {chats.map((chat) => {
          const last = chat.messages[chat.messages.length - 1];
          const preview = last ? `${last.direction === 'out' ? 'Вы: ' : ''}${last.text}` : chat.phone ? formatPhone(chat.phone) : 'Нет сообщений';
          return (
            <button
              key={chat.key}
              className={`chat-item${chat.key === activeKey ? ' active' : ''}`}
              onClick={() => onSelect(chat.key)}
              aria-current={chat.key === activeKey ? 'true' : undefined}
            >
              <Avatar title={chat.title} seed={chat.chatId} />
              <span className="chat-item-body">
                <span className="chat-item-top">
                  <span className="chat-item-title">{chat.title}</span>
                  <span className="chat-item-time">{formatListTime(lastActivity(chat))}</span>
                </span>
                <span className="chat-item-bottom">
                  <span className={`chat-item-preview${last?.status === 'failed' ? ' failed' : ''}`}>{preview}</span>
                  {chat.unread > 0 && <span className="badge">{chat.unread > 99 ? '99+' : chat.unread}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
