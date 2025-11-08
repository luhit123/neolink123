# 🔑 Get Your Firebase Configuration

## Quick Steps to Get Your Firebase Config

1. Go to: https://console.firebase.google.com/project/medilink-f2b56/settings/general

2. Scroll down to "Your apps" section

3. If you see a web app (</> icon), click on it to see the config

4. If you DON'T see a web app:
   - Click "Add app" button
   - Select Web (</> icon)
   - Give it a nickname: "NeoLink Web"
   - Click "Register app"
   - Copy the firebaseConfig object

5. You'll see something like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "medilink-f2b56.firebaseapp.com",
  projectId: "medilink-f2b56",
  storageBucket: "medilink-f2b56.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123..."
};
```

6. Copy those values and I'll update the firebaseConfig.ts file for you!

**Just paste the config here and I'll update everything!**
