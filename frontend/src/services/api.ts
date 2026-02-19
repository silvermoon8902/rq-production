import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(error.config);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  register: (data: { email: string; name: string; password: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  createUser: (data: any) => api.post('/auth/users', data),
  updateUser: (id: number, data: any) => api.patch(`/auth/users/${id}`, data),
};

// Clients
export const clientsApi = {
  getAll: (params?: any) => api.get('/clients', { params }),
  getNiches: () => api.get('/clients/niches'),
  getById: (id: number) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
  update: (id: number, data: any) => api.patch(`/clients/${id}`, data),
  delete: (id: number) => api.delete(`/clients/${id}`),
};

// Team
export const teamApi = {
  getSquads: () => api.get('/team/squads'),
  createSquad: (data: any) => api.post('/team/squads', data),
  updateSquad: (id: number, data: any) => api.patch(`/team/squads/${id}`, data),
  deleteSquad: (id: number) => api.delete(`/team/squads/${id}`),
  getMembers: (params?: any) => api.get('/team/members', { params }),
  getMember: (id: number) => api.get(`/team/members/${id}`),
  createMember: (data: any) => api.post('/team/members', data),
  updateMember: (id: number, data: any) => api.patch(`/team/members/${id}`, data),
  deleteMember: (id: number) => api.delete(`/team/members/${id}`),
  getAllocations: (params?: any) => api.get('/team/allocations', { params }),
  createAllocation: (data: any) => api.post('/team/allocations', data),
  updateAllocation: (id: number, data: any) => api.patch(`/team/allocations/${id}`, data),
  deleteAllocation: (id: number) => api.delete(`/team/allocations/${id}`),
};

// Demands
export const demandsApi = {
  getBoard: (params?: any) => api.get('/demands/board', { params }),
  getColumns: () => api.get('/demands/columns'),
  createColumn: (data: any) => api.post('/demands/columns', data),
  updateColumn: (id: number, data: any) => api.patch(`/demands/columns/${id}`, data),
  deleteColumn: (id: number) => api.delete(`/demands/columns/${id}`),
  getAll: (params?: any) => api.get('/demands', { params }),
  getById: (id: number) => api.get(`/demands/${id}`),
  create: (data: any) => api.post('/demands', data),
  update: (id: number, data: any) => api.patch(`/demands/${id}`, data),
  move: (id: number, data: any) => api.post(`/demands/${id}/move`, data),
  getHistory: (id: number) => api.get(`/demands/${id}/history`),
  delete: (id: number) => api.delete(`/demands/${id}`),
};

// Meetings
export const meetingsApi = {
  getAll: (params?: any) => api.get('/meetings', { params }),
  create: (data: any) => api.post('/meetings', data),
};

// Financial
export const financialApi = {
  getDashboard: (params?: any) => api.get('/financial/dashboard', { params }),
  getClientCosts: (clientId: number, params?: any) =>
    api.get(`/financial/clients/${clientId}`, { params }),
};

export default api;
