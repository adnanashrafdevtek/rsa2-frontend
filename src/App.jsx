import { useState } from 'react';
import LoginForm from './components/ui/LoginForm';
import Layout from './Layout'; 
import BackendAdmin from './pages/BackendAdmin';
import Dashboard from './pages/Dashboard';

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginForm onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <Layout>
      {/* Change this line to use either <BackendAdmin /> or <Dashboard /> */}
      <BackendAdmin /> 
    </Layout>
  );
}

export default App;