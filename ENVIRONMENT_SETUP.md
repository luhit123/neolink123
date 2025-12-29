# Environment Setup Guide

This guide explains how to configure environment variables for the NeoLink PICU/NICU Medical Records System.

## Quick Setup

1. Copy the `.env.example` file to create your local `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file and replace the placeholder values with your actual credentials.

## Required Environment Variables

### Firebase Configuration

You'll need to get these values from your Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon and go to "Project settings"
4. Scroll down to "Your apps" section
5. Select your web app or create a new one
6. Copy the configuration values

Required variables:
- `VITE_FIREBASE_API_KEY` - Your Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Your Firebase auth domain (usually `<project-id>.firebaseapp.com`)
- `VITE_FIREBASE_PROJECT_ID` - Your Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Your Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Your Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Your Firebase app ID
- `VITE_FIREBASE_MEASUREMENT_ID` - Your Firebase measurement ID (optional)

### Google Gemini AI API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key or use an existing one
3. Copy the API key

Required variable:
- `VITE_GEMINI_API_KEY` - Your Google Gemini API key

## Example .env File

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyC3K4ZXLpQmRX0sfngQlCESpLPk7dGNGnw
VITE_FIREBASE_AUTH_DOMAIN=medilink-f2b56.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=medilink-f2b56
VITE_FIREBASE_STORAGE_BUCKET=medilink-f2b56.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=484787149271
VITE_FIREBASE_APP_ID=1:484787149271:web:fa62d0b4740bb37fc99392
VITE_FIREBASE_MEASUREMENT_ID=G-E2BG4Q4V1J

# Google Gemini AI API Key
VITE_GEMINI_API_KEY=AIzaSyBDwaDSongySYgUAHWUxcghaTyhKX7ISl4
```

## Security Notes

- **NEVER commit your `.env` file to Git**. It's already added to `.gitignore`.
- The `.env.example` file should only contain placeholder values, never real credentials.
- If you accidentally commit sensitive data, immediately:
  1. Rotate all exposed credentials (generate new API keys)
  2. Remove the sensitive data from Git history
  3. Update your `.env` file with new credentials

## Development

After setting up your `.env` file, you can run the development server:

```bash
npm run dev
```

The application will automatically load environment variables from your `.env` file.

## Production Deployment

For production deployments (e.g., Firebase Hosting, Vercel, Netlify):

1. **DO NOT** commit your `.env` file
2. Set environment variables through your hosting provider's dashboard:
   - **Firebase Hosting**: Use Firebase environment configuration
   - **Vercel**: Add variables in Project Settings > Environment Variables
   - **Netlify**: Add variables in Site Settings > Build & Deploy > Environment

## Troubleshooting

### Error: Missing required environment variables

If you see this error in the console:
```
Missing required environment variables: VITE_FIREBASE_API_KEY, ...
```

**Solution**: Make sure you've created a `.env` file and added all required variables.

### Error: Gemini API key is not configured

If you see this error:
```
Gemini API key is not configured. Please check your .env file.
```

**Solution**: Add your `VITE_GEMINI_API_KEY` to the `.env` file.

### Changes to .env not reflected

If you've updated your `.env` file but don't see the changes:

**Solution**: Restart your development server. Vite loads environment variables at startup.

## Additional Resources

- [Vite Environment Variables Documentation](https://vitejs.dev/guide/env-and-mode.html)
- [Firebase Setup Guide](https://firebase.google.com/docs/web/setup)
- [Google AI Studio](https://makersuite.google.com/)
