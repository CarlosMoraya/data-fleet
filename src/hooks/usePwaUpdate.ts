import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  return {
    needRefresh,
    dismiss: () => setNeedRefresh(false),
    update: () => {
      void updateServiceWorker(true);
    },
  };
}
