# Deepgram Speech-to-Text Setup Guide

## Overview

The application now uses **Deepgram** for medical speech-to-text transcription instead of Gemini. Deepgram's **Nova-3** model is the latest and most accurate speech recognition model, providing superior accuracy for medical dictation and clinical documentation.

## Why Deepgram Nova-3?

✅ **Latest Model**: Nova-3 is Deepgram's most advanced and accurate model
✅ **Superior Accuracy**: Best-in-class recognition of medical terms, medications, and clinical phrases
✅ **Real-Time Streaming**: Live transcription with ultra-low latency (~250ms)
✅ **Smart Formatting**: Automatic punctuation, capitalization, and number formatting
✅ **Reliable**: Production-grade API with 99.9% uptime
✅ **Cost-Effective**: Pay-as-you-go pricing with free tier available

## Setup Instructions

### Step 1: Create Deepgram Account

1. Go to [Deepgram Console](https://console.deepgram.com/)
2. Sign up for a free account
3. You'll get **$200 in free credits** to start with

### Step 2: Get API Key

1. After signing in, go to [API Keys](https://console.deepgram.com/project/default/settings)
2. Click **"Create a New API Key"**
3. Give it a name (e.g., "NICU Medical Records")
4. Copy the API key (you won't be able to see it again!)

### Step 3: Add API Key to Environment

1. Open your `.env` file in the project root
2. Add your Deepgram API key:

```bash
VITE_DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

3. Save the file

### Step 4: Restart Development Server

```bash
npm run dev
```

## Features

### Medical Terminology Recognition

Deepgram's Nova-3 model automatically recognizes:

- **Vitals**: Temperature, Heart Rate, Respiratory Rate, SpO2, Blood Pressure, CRT
- **Respiratory**: CPAP, PEEP, FiO2, PIP, MAP, SIMV, IPPV, HFOV, ventilator settings
- **CNS**: Alert, lethargic, seizures, fontanelle, tone, reflexes
- **CVS**: S1, S2, murmur, tachycardia, bradycardia, perfusion
- **Medications**: Vancomycin, Ampicillin, Gentamicin, Phenobarbitone, Dopamine, etc.
- **Diagnoses**: RDS, Sepsis, HIE, NEC, Meconium Aspiration, etc.

### Smart Formatting

- **Punctuation**: Automatically adds periods, commas
- **Numerals**: Converts spoken numbers to digits (e.g., "fifteen" → "15")
- **Medical Abbreviations**: Recognizes and formats medical terms correctly

## Pricing

### Free Tier
- **$200 in free credits** for new accounts
- Good for approximately **33 hours** of audio transcription
- Perfect for testing and small deployments

### Pay-As-You-Go
- **$0.0059 per minute** for Nova-3 model (live streaming)
- **$0.0043 per minute** for Nova-3 model (pre-recorded)
- **~$5.90 per hour** for real-time streaming
- No monthly fees
- Only pay for what you use

### Enterprise
- Custom pricing for high-volume usage
- Dedicated support
- SLA guarantees

👉 [View Detailed Pricing](https://deepgram.com/pricing)

## Usage in Application

### Recording Clinical Notes

1. Click the **microphone icon** in the clinical note form
2. Speak your clinical dictation naturally
3. Click **stop** when done
4. Deepgram will transcribe your speech automatically
5. The AI will format it into a structured clinical note

### Example Dictation

```
"Patient is a two day old neonate, temperature thirty seven point two,
heart rate one forty, respiratory rate fifty, SpO2 ninety eight percent.
CNS alert and active. CVS S1 S2 heard, no murmur. Chest bilateral air entry equal,
no retractions. Per abdomen soft, bowel sounds present. Patient on CPAP with
PEEP five, FiO2 thirty percent. Started on injection ampicillin one hundred
milligrams per kilogram IV twice daily and injection gentamicin four milligrams
per kilogram IV once daily. Impression respiratory distress syndrome moderate
improving on CPAP. Plan continue CPAP, wean as tolerated, monitor vitals closely."
```

This will be accurately transcribed with all medical terms preserved!

## Troubleshooting

### Error: "Deepgram not configured"

**Solution**: Make sure you've added `VITE_DEEPGRAM_API_KEY` to your `.env` file and restarted the server.

### Error: "Authentication failed"

**Solution**: Your API key is invalid. Double-check the key in Deepgram console and update your `.env` file.

### Error: "Rate limit exceeded"

**Solution**: You've exceeded your usage quota. Check your Deepgram dashboard and upgrade if needed.

### Poor Transcription Accuracy

**Solutions**:
- Speak clearly and at a normal pace
- Use a good quality microphone
- Minimize background noise
- Use medical terminology consistently

## API Documentation

For advanced configuration and features, see:

- [Deepgram API Documentation](https://developers.deepgram.com/)
- [Nova-2-Medical Model](https://developers.deepgram.com/docs/nova-2)
- [Supported Languages](https://developers.deepgram.com/docs/languages)

## Support

### Deepgram Support
- [Documentation](https://developers.deepgram.com/docs)
- [Community Discord](https://discord.gg/deepgram)
- [Support Portal](https://deepgram.com/contact)

### Application Support
If you encounter issues with the integration:
1. Check console logs for error messages
2. Verify API key is correctly configured
3. Test with a simple recording first
4. Contact support with error details

## Migration from MedASR/Gemini

The application has been updated to use Deepgram instead of:
- ❌ RunPod MedASR (deprecated)
- ❌ Gemini speech-to-text (still used for note formatting)

**No action needed** - the migration is automatic. Just add your Deepgram API key and you're ready to go!

---

**Ready to use medical-grade speech recognition?** 🎤

Get started at [console.deepgram.com](https://console.deepgram.com/) today!
