import { useState } from 'react';

export default function LoginForm({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    // REPLACE THE OLD IF/ELSE BLOCK WITH THIS:
    if (response.ok) {
      console.log("Login Success! User data:", data.user); 
      onLoginSuccess(data.user); 
    } else {
      console.log("Login Failed. Server message:", data.message); 
      setError(data.message);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded shadow-md">
      <h2 className="text-xl font-bold mb-4">Login</h2>
      {error && <p className="text-red-500">{error}</p>}
      <input type="text" placeholder="Username" className="block border p-2 mb-2 w-full"
  onChange={(e) => setUsername(e.target.value)} required 
/>
      <input 
        type="password" placeholder="Password" className="block border p-2 mb-2 w-full"
        onChange={(e) => setPassword(e.target.value)} required 
      />
      <button type="submit" className="bg-blue-500 text-white p-2 w-full">Sign In</button>
    </form>
  );
}