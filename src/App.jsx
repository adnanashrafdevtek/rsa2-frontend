import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';

// Importing all your pages from the pages/ folder
import LoginForm from './pages/LoginForm';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ExcelUploadPage from './pages/ExcelUploadPage';
import ProfilePage from './pages/ProfilePage';

const App = () => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
  };
  
  return (
    <BrowserRouter>
      <Routes>
        {/* Login and Reset Password routes are outside Layout */}
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginForm onLoginSuccess={handleLogin} />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected Routes wrapped in Layout */}
        <Route path="/*" element={user ? (
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
              <Route path="/classes" element={<Dashboard initialResource="classes" />} />
              <Route path="/rooms" element={<Dashboard initialResource="rooms" />} />
              <Route path="/schedules" element={<Dashboard initialResource="schedules" />} />
              <Route path="/events" element={<Dashboard initialResource="events" />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin/upload-excel" element={<ExcelUploadPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        ) : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;