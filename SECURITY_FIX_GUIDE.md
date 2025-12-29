# Security Fix Guide - API Keys Exposed on GitHub

## ⚠️ What Happened

Your Firebase API keys and Gemini API key were hardcoded in `firebaseConfig.ts` and committed to GitHub in commit `b264133`. GitHub detected this and sent you a security alert.

## 🔍 Current Status

### Files That Were Exposed:
- **firebaseConfig.ts** (commit b264133) - Contained hardcoded Firebase credentials
- **.firebase/hosting.ZGlzdA.cache** - Firebase deployment cache (now removed)

### What I've Fixed:
✅ Updated `firebaseConfig.ts` to use environment variables (already done previously)
✅ Removed `.firebase/` directory from git tracking
✅ `.env` is properly in `.gitignore`
✅ Created this security guide

## 🚨 CRITICAL: What You MUST Do Now

### 1. Regenerate Your Gemini API Key (REQUIRED)

**Your Gemini API key is compromised and MUST be rotated immediately.**

Steps:
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Delete the old API key: `AIzaSyBDwaDSongySYgUAHWUxcghaTyhKX7ISl4`
3. Create a new API key
4. Update your `.env` file with the new key:
   ```
   VITE_GEMINI_API_KEY=your_new_api_key_here
   ```

### 2. Understand Firebase Web API Keys (INFORMATIONAL)

**Good News:** Firebase Web API keys are actually MEANT to be public. They're used in client-side code and are not secret. The real security comes from:

- **Firestore Security Rules** - Control who can read/write data
- **Firebase Authentication** - Verify user identity
- **App Check** (optional) - Prevent abuse from unauthorized apps

**However**, it's still best practice to use environment variables as we do now.

### 3. Review Your Firebase Security Rules

Make sure your Firestore security rules are properly configured:

```bash
firebase deploy --only firestore:rules
```

Check that:
- Only authenticated users can access data
- Users can only access their own institution's data
- Proper role-based access control is in place

### 4. Clean Git History (OPTIONAL BUT RECOMMENDED)

The API keys are still in your git history. To completely remove them:

**Option A: Use BFG Repo-Cleaner (Recommended)**
```bash
# Install BFG
brew install bfg  # macOS
# or download from https://reps.io/bfg-repo-cleaner/

# Backup your repo first!
cp -r /Users/northeo/Desktop/neolink123 /Users/northeo/Desktop/neolink123-backup

# Remove the old firebaseConfig.ts from history
bfg --replace-text passwords.txt  # Create passwords.txt with your API keys
bfg --delete-files firebaseConfig.ts

# Clean up
cd /Users/northeo/Desktop/neolink123
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: This rewrites history)
git push --force
```

**Option B: Start Fresh (Easier)**
```bash
# Create a new repo without the compromised history
cd /Users/northeo/Desktop
mv neolink123 neolink123-old
git clone https://github.com/yourusername/your-repo.git neolink123-new

# Copy current files (excluding .git)
rsync -av --exclude='.git' neolink123-old/ neolink123-new/

# Commit fresh
cd neolink123-new
git add .
git commit -m "Fresh start with secure environment variables"
git push --force
```

### 5. Push Your Security Fix

```bash
git push origin main
```

## 📋 Security Checklist

- [ ] Regenerated Gemini API key
- [ ] Updated `.env` with new Gemini API key
- [ ] Verified `.env` is in `.gitignore`
- [ ] Reviewed Firebase Security Rules
- [ ] Tested app with new API key
- [ ] Pushed security fixes to GitHub
- [ ] (Optional) Cleaned git history
- [ ] Rebuild and redeploy: `npm run build && firebase deploy`

## 🛡️ Best Practices Going Forward

### ✅ DO:
- Always use environment variables for API keys
- Keep `.env` in `.gitignore`
- Use `.env.example` for documentation (without actual keys)
- Review code before committing
- Enable GitHub secret scanning alerts
- Rotate API keys regularly

### ❌ DON'T:
- Hardcode API keys in source code
- Commit `.env` files to git
- Share API keys in chat, email, or documentation
- Use production keys in development

## 📚 Additional Resources

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Google Cloud API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)

## ✅ Verification

After following these steps, verify everything works:

```bash
# Clear local build
rm -rf dist/

# Rebuild with new environment variables
npm run build

# Test locally
npm run dev

# Deploy when verified
firebase deploy --only hosting
```

---

**Remember:** The most important action is to regenerate your Gemini API key immediately!
