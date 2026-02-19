import { create } from 'zustand';

interface FinanceVisibilityState {
  isHidden: boolean;
  toggle: () => void;
}

export const useFinanceVisibilityStore = create<FinanceVisibilityState>((set) => ({
  isHidden: false,
  toggle: () => set((s) => ({ isHidden: !s.isHidden })),
}));
