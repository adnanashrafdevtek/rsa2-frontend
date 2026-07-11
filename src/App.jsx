import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import ExcelUploadPage from './pages/ExcelUploadPage';
import LoginForm from './pages/LoginForm';
import TeacherDashboard from './pages/TeacherDashboard'
import ProfilePage from './pages/ProfilePage'
function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginForm onLoginSuccess={setUser} />;
  }

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;