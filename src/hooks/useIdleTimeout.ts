import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_TIMEOUT = 60 * 60 * 1000; // 60 minutos

export function useIdleTimeout(timeoutMs: number = DEFAULT_TIMEOUT) {
  const { logout, user } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback(async () => {
    if (user) {
      console.log('Sessão encerrada por inatividade.');
      await logout();
    }
  }, [logout, user]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (user) {
      timeoutRef.current = setTimeout(handleLogout, timeoutMs);
    }
  }, [handleLogout, timeoutMs, user]);

  useEffect(() => {
    if (!user) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'wheel',
      'click'
    ];

    const handleEvent = () => resetTimer();

    // Pausa o timer quando a aba fica em background, reinicia ao voltar
    const handleVisibility = () => {
      if (document.hidden) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      } else {
        resetTimer();
      }
    };

    // Inicializa o timer
    resetTimer();

    events.forEach(event => {
      window.addEventListener(event, handleEvent);
    });
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(event => {
        window.removeEventListener(event, handleEvent);
      });
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, resetTimer]);
}
