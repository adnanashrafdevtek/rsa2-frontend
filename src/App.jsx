import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import ExcelUploadPage from './pages/ExcelUploadPage'
import ProfilePage from './pages/ProfilePage'

export default function App(){
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
  )
}
