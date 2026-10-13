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
import Annoucements from './pages/Annoucements';

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

  // Role IDs in your database: Teacher = 1, Admin = 2, Student = 3
     const roleName = String(
     user?.role_name || localStorage.getItem('planner-role') || ''
   ).trim().toLowerCase();
   const isAdmin = roleName === 'admin';
   const isTeacher = roleName === 'teacher';
   const homePath = isAdmin ? '/' : '/teacher-dashboard';

  return (
    <BrowserRouter>
      <Routes>
        {/* Login and Reset Password routes are outside Layout */}
        <Route
          path="/login"
          element={
            user && (isTeacher || isAdmin) ? (
              <Navigate to={homePath} replace />
            ) : (
              <LoginForm onLoginSuccess={handleLogin} />
            )
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes wrapped in Layout */}
        <Route
          path="/*"
          element={
            user && (isTeacher || isAdmin) ? (
              <Layout>
                <Routes>
                  {/* Admin-only pages */}
                  <Route
                    path="/"
                    element={isAdmin ? <Dashboard /> : <Navigate to="/teacher-dashboard" replace />}
                  />
                  <Route
                    path="/classes"
                    element={isAdmin ? <Dashboard initialResource="classes" /> : <Navigate to={homePath} replace />}
                  />
                  <Route
                    path="/rooms"
                    element={isAdmin ? <Dashboard initialResource="rooms" /> : <Navigate to={homePath} replace />}
                  />
                  <Route
                    path="/schedules"
                    element={isAdmin ? <Dashboard initialResource="schedules" /> : <Navigate to={homePath} replace />}
                  />
                  <Route
                    path="/admin/upload-excel"
                    element={isAdmin ? <ExcelUploadPage /> : <Navigate to={homePath} replace />}
                  />

                  {/* Teacher-only page */}
                  <Route
                    path="/teacher-dashboard"
                    element={isTeacher ? <TeacherDashboard /> : <Navigate to="/" replace />}
                  />

                  {/* Shared pages */}
                  <Route path="/events" element={<Annoucements />} />
                  <Route path="/announcements" element={<Annoucements />} />
                  <Route path="/profile" element={<ProfilePage />} />

                  <Route path="*" element={<Navigate to={homePath} replace />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;