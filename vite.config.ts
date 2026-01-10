import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    // Build optimization for world-class performance
    build: {
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
        },
      },
      rollupOptions: {
        output: {
          // Manual chunk splitting for optimal loading
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'animation-vendor': ['framer-motion'],
            'chart-vendor': ['recharts'],
            // Feature chunks
            'forms': ['react-hook-form', 'zod'],
            'virtualization': ['react-virtuoso'],
          },
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
    },
    // Performance optimizations
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'framer-motion',
      ],
    },
    plugins: [
      react({
        // Enable Fast Refresh for better DX
        fastRefresh: true,
      }),
      VitePWA({
        registerType: 'prompt', // Changed to 'prompt' for immediate update notification
        includeAssets: ['pwa-192.png', 'pwa-512.png', 'apple-touch-icon.png'],
        devOptions: {
          enabled: true, // Enable in development
        },
        manifest: {
          name: 'NeoLink PICU/NICU Records',
          short_name: 'NeoLink',
          description: 'Medical Records System for PICU/NICU - Professional Healthcare Management',
          theme_color: '#0EA5E9', // Medical teal from theme
          background_color: '#F8FAFC', // Light background
          display: 'standalone', // Hide browser UI completely
          scope: '/',
          start_url: '/',
          orientation: 'portrait-primary',
          categories: ['medical', 'healthcare', 'productivity'],
          dir: 'ltr',
          lang: 'en-US',
          prefer_related_applications: false,
          icons: [
            {
              src: '/pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ],
          // Android-specific features
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          edge_side_panel: {
            preferred_width: 480
          },
          // Launch handler for better app feel
          launch_handler: {
            client_mode: ['navigate-existing', 'auto']
          }
        },
        workbox: {
          // Force immediate activation of new service worker
          skipWaiting: true,
          clientsClaim: true,
          // Clean up old caches
          cleanupOutdatedCaches: true,
          // Cache Firebase auth and API calls appropriately
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'firestore-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'google-apis-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                }
              }
            }
          ],
          // Don't cache auth redirects
          navigateFallback: null
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
