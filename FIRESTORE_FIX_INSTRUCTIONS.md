# Firestore Offline Error Fix

## The Problem
Your app's service worker is caching the old Firestore configuration that tried to connect to a named database "neolink". Even though we fixed the code, the browser cache is still using the old configuration.

## Quick Fix Steps

### 1. Clear Service Worker (REQUIRED)
1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Go to **Application** tab
3. In the left sidebar, click **Service Workers**
4. Click **Unregister** next to all service workers
5. Click **Clear site data** button at the top

### 2. Clear Cache Storage
1. Still in DevTools > Application tab
2. In the left sidebar, expand **Cache Storage**
3. Right-click each cache and select **Delete**
4. Look for these caches:
   - `firestore-cache`
   - `workbox-*`
   - Any Google Fonts caches

### 3. Clear All Storage
1. In DevTools > Application tab
2. Click **Clear storage** in the left sidebar
3. Check all boxes:
   - ✅ Unregister service workers
   - ✅ Local and session storage
   - ✅ IndexedDB
   - ✅ Web SQL
   - ✅ Cache storage
4. Click **Clear site data** button

### 4. Hard Refresh
1. Close DevTools
2. Do a hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)

### 5. Restart Dev Server
```bash
# Stop the current dev server (Ctrl+C)
# Then restart:
npm run dev
```

## Verification
After these steps, refresh the browser and check the console. You should see:
- ✅ Auth persistence ready
- ✅ User doc fetched
- ✅ No "client is offline" errors

## If Still Not Working
If you still see the "neolink" database in the URLs after clearing everything, the issue might be:
1. **Multiple browser tabs open** - Close ALL tabs for this app
2. **Old build artifacts** - Delete the `dist` folder and rebuild
3. **The named database might actually exist** - Check Firebase Console

## Alternative: Try Incognito Mode
Open the app in an incognito/private window to test with a clean slate:
- Chrome: Cmd+Shift+N (Mac) or Ctrl+Shift+N (Windows)
- This bypasses all cached service workers
