import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  checkAccount,
  getSettings,
  GreenApiError,
  sendMessage,
  setSettings,
  type Credentials,
  type InstanceSettings,
} from './api/greenApi';
import { ChatWindow } from './components/ChatWindow';
import { ChatBubbleIcon } from './components/icons';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import type { NotificationEvent } from './lib/notifications';
import { formatPhone } from './lib/phone';
import { clearCredentials, loadChats, loadCredentials, saveChats, saveCredentials } from './lib/storage';
import { chatsReducer, findChat, newKey, phoneChatId, sortChats } from './state/chats';
import type { Chat, ChatMessage } from './types';

export default function App() {
  const [creds, setCreds] = useState<Credentials | null>(() => loadCredentials());

  if (!creds) {
    return (
      <LoginScreen
        onLogin={(c) => {
          saveCredentials(c);
          setCreds(c);
        }}
      />
    );
  }

  return (
    <Messenger
      key={creds.idInstance}
      creds={creds}
      onLogout={() => {
        clearCredentials();
        setCreds(null);
      }}
    />
  );
}

/** Нужные для HTTP API настройки инстанса: webhookUrl пустой, уведомления включены. */
const REQUIRED_SETTINGS: Partial<InstanceSettings> = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
  outgoingAPIMessageWebhook: 'yes',
};

function settingsProblem(settings: InstanceSettings): string | null {
  if (settings.webhookUrl) return 'В инстансе задан webhookUrl — входящие сообщения не будут приходить сюда.';
  if (settings.incomingWebhook && settings.incomingWebhook !== 'yes') {
    return 'В инстансе отключены уведомления о входящих сообщениях.';
  }
  return null;
}

function Messenger({ creds, onLogout }: { creds: Credentials; onLogout: () => void }) {
  const [chats, dispatch] = useReducer(chatsReducer, creds.idInstance, loadChats);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [settingsWarning, setSettingsWarning] = useState<string | null>(null);
  const [fixingSettings, setFixingSettings] = useState(false);

  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  // Сохраняем переписку локально, чтобы она не пропадала при перезагрузке страницы.
  useEffect(() => {
    saveChats(creds.idInstance, chats);
  }, [creds.idInstance, chats]);

  // Проверяем, что инстанс настроен на получение уведомлений через HTTP API.
  useEffect(() => {
    let cancelled = false;
    getSettings(creds)
      .then((s) => !cancelled && setSettingsWarning(settingsProblem(s)))
      .catch(() => {
        /* не критично: проблемы с получением будут видны по статусу соединения */
      });
    return () => {
      cancelled = true;
    };
  }, [creds]);

  const fixSettings = async () => {
    setFixingSettings(true);
    try {
      await setSettings(creds, REQUIRED_SETTINGS);
      setSettingsWarning(null);
    } catch (e) {
      setSettingsWarning(e instanceof GreenApiError ? e.message : 'Не удалось сохранить настройки.');
    } finally {
      setFixingSettings(false);
    }
  };

  const handleEvent = useCallback((event: NotificationEvent) => {
    if (event.kind === 'message') {
      dispatch({
        type: 'messageReceived',
        chatId: event.chatId,
        chatName: event.chatName,
        phone: event.phone,
        isGroup: event.isGroup,
        message: event.message,
        activeKey: document.hidden ? null : activeKeyRef.current,
      });
    } else if (event.kind === 'status') {
      dispatch({ type: 'statusUpdated', chatId: event.chatId, idMessage: event.idMessage, status: event.status });
    }
  }, []);

  const connection = useNotificationPolling(creds, handleEvent);

  // Счётчик непрочитанных в заголовке вкладки.
  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) MAX Chat` : 'MAX Chat · GREEN-API';
  }, [totalUnread]);

  // Сбрасываем непрочитанные у открытого чата (в т.ч. при возврате на вкладку).
  const activeChat = chats.find((c) => c.key === activeKey) ?? null;
  useEffect(() => {
    if (!activeChat?.unread) return;
    if (!document.hidden) dispatch({ type: 'chatRead', chatKey: activeChat.key });
    const onVisible = () => !document.hidden && dispatch({ type: 'chatRead', chatKey: activeChat.key });
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeChat?.key, activeChat?.unread]);

  const createChat = async (phone: string): Promise<string | null> => {
    const existing = findChat(chatsRef.current, phoneChatId(phone), phone);
    if (existing) {
      setActiveKey(existing.key);
      return null;
    }

    let chatId: string;
    try {
      const found = await checkAccount(creds, phone);
      if (!found) return `У номера ${formatPhone(phone)} нет аккаунта MAX.`;
      chatId = found;
    } catch (e) {
      // Проверка номера могла упереться в лимиты — тогда отправляем по номеру (79991234567@c.us),
      // а настоящий chatId подставится из первого уведомления по этому чату.
      if (e instanceof GreenApiError && e.status !== 0 && e.status !== 401 && e.status !== 403) {
        console.warn('checkAccount не удался, используем отправку по номеру', e);
        chatId = phoneChatId(phone);
      } else {
        return e instanceof GreenApiError ? e.message : 'Не удалось проверить номер.';
      }
    }

    const sameChat = findChat(chatsRef.current, chatId, phone);
    if (sameChat) {
      setActiveKey(sameChat.key);
      return null;
    }

    const chat: Chat = {
      key: newKey(),
      chatId,
      phone,
      title: formatPhone(phone),
      messages: [],
      unread: 0,
      createdAt: Date.now(),
    };
    dispatch({ type: 'chatCreated', chat });
    setActiveKey(chat.key);
    return null;
  };

  const deliver = async (chatKey: string, localId: string, text: string) => {
    // Берём актуальный chatId: он мог обновиться после первого уведомления.
    const chat = chatsRef.current.find((c) => c.key === chatKey);
    if (!chat) return;
    try {
      const idMessage = await sendMessage(creds, chat.chatId, text);
      dispatch({ type: 'messageSent', chatKey, localId, idMessage });
    } catch (e) {
      dispatch({
        type: 'messageFailed',
        chatKey,
        localId,
        error: e instanceof GreenApiError ? e.message : 'Не удалось отправить сообщение',
      });
    }
  };

  const send = (text: string) => {
    if (!activeChat) return;
    const message: ChatMessage = {
      id: newKey('local'),
      text,
      direction: 'out',
      timestamp: Date.now(),
      status: 'pending',
    };
    dispatch({ type: 'messageQueued', chatKey: activeChat.key, message });
    void deliver(activeChat.key, message.id, text);
  };

  const retry = (message: ChatMessage) => {
    if (!activeChat || message.status !== 'failed') return;
    dispatch({ type: 'messageRetry', chatKey: activeChat.key, localId: message.id });
    void deliver(activeChat.key, message.id, message.text);
  };

  const sortedChats = useMemo(() => sortChats(chats), [chats]);

  return (
    <div className={`app${activeChat ? ' has-active' : ''}`}>
      <Sidebar
        chats={sortedChats}
        activeKey={activeKey}
        idInstance={creds.idInstance}
        connection={connection}
        settingsWarning={settingsWarning}
        onFixSettings={fixSettings}
        fixingSettings={fixingSettings}
        onSelect={setActiveKey}
        onCreateChat={createChat}
        onLogout={onLogout}
      />
      {activeChat ? (
        <ChatWindow
          chat={activeChat}
          onSend={send}
          onRetry={retry}
          onBack={() => setActiveKey(null)}
          onDelete={() => {
            dispatch({ type: 'chatRemoved', chatKey: activeChat.key });
            setActiveKey(null);
          }}
        />
      ) : (
        <section className="chat-placeholder">
          <ChatBubbleIcon width={48} height={48} />
          <p>Выберите чат или создайте новый по номеру телефона</p>
        </section>
      )}
    </div>
  );
}
