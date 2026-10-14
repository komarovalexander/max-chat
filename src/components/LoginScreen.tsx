import { useState, type FormEvent } from 'react';
import { defaultApiUrl, getStateInstance, GreenApiError, normalizeApiUrl, type Credentials } from '../api/greenApi';
import { EyeIcon } from './icons';

const STATE_MESSAGES: Record<string, string> = {
  notAuthorized: 'Инстанс не авторизован в MAX. Откройте личный кабинет GREEN-API и отсканируйте QR-код.',
  starting: 'Инстанс запускается. Подождите минуту и попробуйте снова.',
  blocked: 'Аккаунт MAX заблокирован.',
  sleepMode: 'Инстанс в спящем режиме. Проверьте телефон с MAX.',
  yellowCard: 'Аккаунт MAX временно ограничен (yellowCard).',
};

interface LoginScreenProps {
  initial?: Partial<Credentials>;
  onLogin: (creds: Credentials) => void;
}

export function LoginScreen({ initial, onLogin }: LoginScreenProps) {
  const [idInstance, setIdInstance] = useState(initial?.idInstance ?? '');
  const [apiTokenInstance, setApiTokenInstance] = useState(initial?.apiTokenInstance ?? '');
  const [apiUrl, setApiUrl] = useState(initial?.apiUrl ?? '');
  const [apiUrlTouched, setApiUrlTouched] = useState(Boolean(initial?.apiUrl));
  const [showToken, setShowToken] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveApiUrl = apiUrlTouched && apiUrl.trim() ? apiUrl : defaultApiUrl(idInstance);
  const canSubmit = /^\d{6,}$/.test(idInstance.trim()) && apiTokenInstance.trim().length > 10 && !loading;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const creds: Credentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: normalizeApiUrl(effectiveApiUrl),
    };
    setLoading(true);
    setError(null);
    try {
      const state = await getStateInstance(creds);
      if (state !== 'authorized') {
        setError(STATE_MESSAGES[state] ?? `Инстанс в состоянии «${state}». Для работы нужно состояние authorized.`);
        return;
      }
      onLogin(creds);
    } catch (e) {
      setError(e instanceof GreenApiError ? e.message : 'Не удалось проверить учётные данные.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-logo" aria-hidden>
          <svg viewBox="0 0 32 32" width="56" height="56">
            <rect width="32" height="32" rx="10" fill="url(#lg)" />
            <path d="M9 22V11l7 6 7-6v11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0" stopColor="#47a0ff" />
                <stop offset="1" stopColor="#7a5cff" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1>Вход в чат</h1>
        <p className="login-sub">
          Введите параметры инстанса из{' '}
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            личного кабинета GREEN-API
          </a>
        </p>

        <label className="field">
          <span>idInstance</span>
          <input
            inputMode="numeric"
            autoComplete="username"
            placeholder="3100123456"
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />
        </label>

        <label className="field">
          <span>apiTokenInstance</span>
          <div className="input-with-button">
            <input
              type={showToken ? 'text' : 'password'}
              autoComplete="current-password"
              spellCheck={false}
              placeholder="d75b3a66374942c5b3c019c698abc2067e151558acbd412345"
              value={apiTokenInstance}
              onChange={(e) => setApiTokenInstance(e.target.value)}
              required
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowToken((v) => !v)}
              aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}
            >
              <EyeIcon off={showToken} />
            </button>
          </div>
        </label>

        {showAdvanced ? (
          <label className="field">
            <span>Хост API (apiUrl)</span>
            <input
              spellCheck={false}
              placeholder="https://3100.api.green-api.com"
              value={apiUrlTouched ? apiUrl : effectiveApiUrl}
              onChange={(e) => {
                setApiUrlTouched(true);
                setApiUrl(e.target.value);
              }}
            />
            <small>Указан в личном кабинете рядом с idInstance.</small>
          </label>
        ) : (
          <button type="button" className="link-button" onClick={() => setShowAdvanced(true)}>
            Хост API: {effectiveApiUrl.replace(/^https?:\/\//, '')} · изменить
          </button>
        )}

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="primary-button" disabled={!canSubmit}>
          {loading ? 'Проверяем…' : 'Войти'}
        </button>

        <p className="login-note">
          Данные хранятся только в этом браузере и отправляются напрямую в GREEN-API.
        </p>
      </form>
    </main>
  );
}
