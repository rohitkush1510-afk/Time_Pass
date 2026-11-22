import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL 
  const socketUrl = env.VITE_SOCKET_URL || apiUrl

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT) ,
      proxy: {
        '/api': apiUrl,
        '/socket.io': { target: socketUrl, ws: true }
      }
    }
  }
})
