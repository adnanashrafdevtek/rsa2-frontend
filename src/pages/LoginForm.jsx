import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BASE } from '../api/backendClient';

export default function LoginForm({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      if (response.ok) {
        const roleId = Number(data.user.role_id);

        // Store essential user info
        localStorage.setItem('planner-current-user-id', data.user.id);
        localStorage.setItem('planner-current-role-id', roleId);
        localStorage.setItem('planner-current-user-name', `${data.user.first_name} ${data.user.last_name}`);
        localStorage.setItem('planner-role', roleId === 1 ? 'Admin' : 'Teacher');
        
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }

        // Strictly route based on role ID: 1 for Admin (Dashboard), 2 for Teacher (TeacherDashboard)
        if (roleId === 2) {
          navigate('/teacher-dashboard');
        } else if (roleId === 1) {
          navigate('/'); // Maps to Dashboard.jsx
        } else {
          setError('Unauthorized role type');
        }
        
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      console.error("Fetch error:", err); 
      setError('Server error, please try again.');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="w-80 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold">Login</h2>
        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
        
        <input 
          className="mb-3 w-full rounded border p-2" 
          placeholder="Email" 
          value={username}
          onChange={(e) => setUsername(e.target.value)} 
        />
        <input 
          className="mb-3 w-full rounded border p-2" 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)} 
        />
        <button type="submit" className="w-full rounded bg-teal-600 py-2 text-white">Login</button>
        
        <div className="mt-3 text-center">
          <Link to="/reset-password" className="text-xs text-teal-600 hover:underline">
            Forgot Password?
          </Link>
        </div>
      </form>
    </div>
  );
}