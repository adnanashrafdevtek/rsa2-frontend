<<<<<<< HEAD
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
=======
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import ExcelUploadPage from './pages/ExcelUploadPage'
>>>>>>> 0d5461d6e3de2701476733d732e7a8ec1c05fa66

  return (
<<<<<<< HEAD
    <Layout>
      {/* Change this line to use either <BackendAdmin /> or <Dashboard /> */}
      <BackendAdmin /> 
    </Layout>
  );
=======
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/classes" element={<Dashboard initialResource="classes" />} />
          <Route path="/rooms" element={<Dashboard initialResource="rooms" />} />
          <Route path="/schedules" element={<Dashboard initialResource="schedules" />} />
          <Route path="/events" element={<Dashboard initialResource="events" />} />
          <Route path="/admin/upload-excel" element={<ExcelUploadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
>>>>>>> 0d5461d6e3de2701476733d732e7a8ec1c05fa66
}

export default App;