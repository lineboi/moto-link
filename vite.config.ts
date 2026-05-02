import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Auto-update: new service worker activates silently on next navigation
      registerType: 'autoUpdate',
      // Injects the SW registration snippet automatically into the build
      injectRegister: 'auto',

      workbox: {
        // Precache all compiled app-shell assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // SPA fallback — offline navigation always serves index.html
        navigateFallback: 'index.html',

        // Exclude Supabase Edge Function calls from the service worker
        // so network errors surface cleanly instead of being silently swallowed
        navigateFallbackDenylist: [/^\/functions\/v1\//],

        runtimeCaching: [
          {
            // Cache the CARTO Dark Matter vector tile style JSON so MapLibre
            // initialises correctly even when the user enters a dead zone.
            // StaleWhileRevalidate: serve from cache instantly, refresh in bg.
            urlPattern:
              /^https:\/\/basemaps\.cartocdn\.com\/gl\/dark-matter-gl-style/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'carto-map-style',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache the OpenFreeMap/CARTO tile CDN fonts/glyphs if they appear
            urlPattern: /^https:\/\/basemaps\.cartocdn\.com\/fonts\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days — fonts rarely change
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      manifest: {
        name: 'Moto-Link · Kigali',
        short_name: 'Moto-Link',
        description:
          'Vernacular voice navigation for Kigali moto drivers — Lyftathon Kigali 2026',
        theme_color: '#06122A',
        background_color: '#06122A',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'rw',
        categories: ['navigation', 'travel', 'utilities'],
        icons: [
          {
            src: 'pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          // Keep the existing favicon as a fallback for older browsers
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },

      // Only enable the SW in production builds.
      // Dev mode runs without caching to keep Vite HMR fast.
      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    host: true,
    port: 5173,
  },
})
