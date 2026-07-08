import React, { useState } from 'react';

export default function LoginForm({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        onLoginSuccess(data.user);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Server error, please try again.');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="w-80 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold">Login</h2>
        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
        <input className="mb-3 w-full rounded border p-2" placeholder="Email" onChange={(e) => setUsername(e.target.value)} />
        <input className="mb-3 w-full rounded border p-2" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" className="w-full rounded bg-teal-600 py-2 text-white">Login</button>
      </form>
    </div>
  );
}