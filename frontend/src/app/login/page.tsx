'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch {
      toast.error('Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.jpeg" alt="RQ" className="h-16 w-16 rounded-xl mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">
            <span className="text-primary-300">RQ</span>. Performance
          </h1>
          <p className="text-gray-500 mt-2">Gestão Operacional da Agência</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-dark-900 rounded-xl border border-dark-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
