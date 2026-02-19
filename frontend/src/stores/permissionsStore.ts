import { create } from 'zustand';
import { permissionsApi } from '@/services/api';

export interface PermEntry {
  can_read: boolean;
  can_write: boolean;
}

// Full matrix: role -> module -> permissions
export type PermMatrix = Record<string, Record<string, PermEntry>>;

interface PermissionsState {
  matrix: PermMatrix | null;
  fetchPermissions: () => Promise<void>;
  canRead: (module: string, role: string) => boolean;
  canWrite: (module: string, role: string) => boolean;
  setPermission: (role: string, module: string, entry: PermEntry) => void;
}

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  matrix: null,

  fetchPermissions: async () => {
    try {
      const { data } = await permissionsApi.getAll();
      set({ matrix: data });
    } catch {
      // silently ignore — sidebar falls back to hardcoded roles
    }
  },

  canRead: (module: string, role: string) => {
    const { matrix } = get();
    if (!matrix) return true; // allow while loading
    return matrix[role]?.[module]?.can_read ?? true;
  },

  canWrite: (module: string, role: string) => {
    const { matrix } = get();
    if (!matrix) return false;
    return matrix[role]?.[module]?.can_write ?? false;
  },

  setPermission: (role: string, module: string, entry: PermEntry) => {
    set((state) => ({
      matrix: {
        ...state.matrix,
        [role]: {
          ...(state.matrix?.[role] ?? {}),
          [module]: entry,
        },
      },
    }));
  },
}));
