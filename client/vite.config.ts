import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // הוסף את הבלוק הזה:
  server: {
    host: '0.0.0.0', // מאפשר לשרת להאזין לכל כתובת IP ברשת
    port: 5173,      // וודא שהפורט הזה פתוח בחומת האש במידת הצורך
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'חברותא דיגיטלית',
        short_name: 'חברותא',
        description: 'בית מדרש וירטואלי - לומדים ביחד, בזמן אמת, מכל מקום',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        background_color: '#EFE9D8',
        theme_color: '#1E3A2B',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})