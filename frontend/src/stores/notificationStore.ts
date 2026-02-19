import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationState {
  lastSeenAt: string | null;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      lastSeenAt: null,
      markAllRead: () => set({ lastSeenAt: new Date().toISOString() }),
    }),
    { name: 'rq-notifications' }
  )
);
