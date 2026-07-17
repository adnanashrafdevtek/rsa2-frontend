import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/users': 'http://localhost:3000',
      '/user': 'http://localhost:3000',
      '/roles': 'http://localhost:3000',
      '/classes': 'http://localhost:3000',
      '/class': 'http://localhost:3000',
      '/rooms': 'http://localhost:3000',
      '/room': 'http://localhost:3000',
      '/messages': 'http://localhost:3000',
      '/message': 'http://localhost:3000',
      '/schedules': 'http://localhost:3000',
      '/schedule': 'http://localhost:3000',
      '/student_classes': 'http://localhost:3000',
      '/student_class': 'http://localhost:3000',
      '/clubs': 'http://localhost:3000',
      '/club': 'http://localhost:3000',
      '/events': 'http://localhost:3000',
      '/event': 'http://localhost:3000',
      '/club_has_event': 'http://localhost:3000',
      '/user_schedules': 'http://localhost:3000',
      '/user/import-file': 'http://localhost:3000'
    },
  }
})
