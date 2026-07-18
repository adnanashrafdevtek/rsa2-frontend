import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const [step, setStep] = useState(1); // 1 = Request, 2 = Reset
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleRequest = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:3000/api/request-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      setStep(2);
      setMessage('Token sent! Check your server console (or email).');
    } else {
      setMessage(data.message);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:3000/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      alert('Password updated! Please login.');
      window.location.href = '/login';
    } else {
      setMessage(data.message);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <form onSubmit={step === 1 ? handleRequest : handleReset} className="w-80 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold">{step === 1 ? "Reset Password" : "Enter Token"}</h2>
        {message && <p className="mb-3 text-xs text-red-500">{message}</p>}
        
        {step === 1 ? (
          <input className="mb-3 w-full rounded border p-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        ) : (
          <>
            <input className="mb-3 w-full rounded border p-2" placeholder="6-character Token" value={token} onChange={(e) => setToken(e.target.value)} required />
            <input className="mb-3 w-full rounded border p-2" type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </>
        )}
        
        <button type="submit" className="w-full rounded bg-teal-600 py-2 text-white">
          {step === 1 ? "Send Token" : "Reset Password"}
        </button>
        <Link to="/login" className="mt-3 block text-center text-xs text-slate-500 hover:underline">Back to Login</Link>
      </form>
    </div>
  );
}