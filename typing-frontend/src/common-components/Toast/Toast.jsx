'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import styles from './Toast.module.scss';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback(
    (id) => setToasts((items) => items.filter((item) => item.id !== id)),
    [],
  );
  const push = useCallback(
    (message) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((items) => [...items, { id, message }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push, dismiss }), [dismiss, push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className={styles.region}>
        {toasts.map((toast) => (
          <button
            className={styles.toast}
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            type="button"
          >
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider.');
  return value;
}
