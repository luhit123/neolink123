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
      // Security headers for development server
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
      },
      proxy: {
        // Proxy RunPod API to bypass CORS (note: domain is api.runpod.AI)
        '/api/runpod': {
          target: 'https://api.runpod.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/runpod/, ''),
          secure: true,
          headers: {
            'Connection': 'keep-alive',
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // Ensure Authorization header is forwarded
              const authHeader = req.headers['authorization'];
              if (authHeader) {
                proxyReq.setHeader('Authorization', authHeader);
              }
              console.log('🔀 Proxying to RunPod:', req.url);
            });
            proxy.on('proxyRes', (proxyRes) => {
              console.log('📥 RunPod response:', proxyRes.statusCode);
            });
          },
        },
      },
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
          enabled: false, // Disabled to fix Firestore offline issue
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
          // IMPORTANT: Exclude Firebase/Google APIs from service worker
          // Firestore uses streaming connections that break with caching
          navigateFallbackDenylist: [
            /^\/api\//,
            /firestore\.googleapis\.com/,
            /identitytoolkit\.googleapis\.com/,
            /securetoken\.googleapis\.com/
          ],
          // Don't intercept any Google/Firebase API calls
          // CRITICAL: Do NOT cache Firestore, Auth, or any Firebase APIs
          runtimeCaching: [
            {
              // CRITICAL: NetworkOnly for ALL Firestore connections
              // This prevents service worker from interfering with streaming
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // NetworkOnly for Firebase Auth endpoints
              urlPattern: /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // NetworkOnly for any googleapis that's not fonts
              urlPattern: /^https:\/\/(?!fonts\.).*\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Only cache static assets like fonts
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
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
