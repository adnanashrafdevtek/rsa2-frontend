import { useUser } from './UserContext'; // Import the hook
import { BASE } from '../api/backendClient';

export default function LoginForm() {
  const { setUser } = useUser(); // Access the setter
  // ... (rest of your state code)

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
        setUser(data.user); // Sets user globally; persists while page is open
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Server error');
    }
  };
  // ... (rest of component)
}