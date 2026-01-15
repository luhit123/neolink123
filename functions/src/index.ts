import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

admin.initializeApp();

const RUNPOD_API_KEY = functions.config().runpod?.api_key || process.env.RUNPOD_API_KEY;
const MEDASR_ENDPOINT_ID = functions.config().runpod?.medasr_endpoint || process.env.MEDASR_ENDPOINT_ID || 'tiv2evbbzqxdkg';
const RUNPOD_BASE_URL = 'https://api.runpod.io/v2';

interface RunPodJobResponse {
  id: string;
  status: string;
}

interface RunPodStatusResponse {
  id: string;
  status: string;
  output?: {
    transcription?: string;
    text?: string;
    transcript?: string;
  };
  error?: string;
}

/**
 * MedASR Transcription - Submit audio for transcription
 */
export const medAsrTranscribe = functions.https.onCall(async (data, context) => {
  // Verify authentication (optional but recommended)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to use transcription'
    );
  }

  const { audio } = data;

  if (!audio) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Audio data is required'
    );
  }

  if (!RUNPOD_API_KEY) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'RunPod API key not configured'
    );
  }

  try {
    // Submit job to RunPod
    const submitResponse = await fetch(`${RUNPOD_BASE_URL}/${MEDASR_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          audio: audio,
          language: 'en',
          task: 'transcribe'
        }
      })
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`RunPod submit failed: ${submitResponse.status} - ${errorText}`);
    }

    const jobData: RunPodJobResponse = await submitResponse.json() as RunPodJobResponse;
    const jobId = jobData.id;

    console.log(`MedASR job submitted: ${jobId}`);

    // Poll for completion (max 2 minutes)
    const maxWaitMs = 120000;
    const pollIntervalMs = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const statusResponse = await fetch(`${RUNPOD_BASE_URL}/${MEDASR_ENDPOINT_ID}/status/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        }
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData: RunPodStatusResponse = await statusResponse.json() as RunPodStatusResponse;

      if (statusData.status === 'COMPLETED') {
        const output = statusData.output;
        if (output) {
          const transcription = output.transcription || output.text || output.transcript || '';
          console.log(`MedASR completed: ${transcription.substring(0, 100)}...`);
          return { transcription, jobId };
        }
        throw new Error('No transcription in response');
      }

      if (statusData.status === 'FAILED') {
        throw new Error(statusData.error || 'Transcription job failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Transcription timeout - job took too long');

  } catch (error: any) {
    console.error('MedASR error:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Transcription failed: ${error.message}`
    );
  }
});

/**
 * Health check endpoint
 */
export const healthCheck = functions.https.onRequest((req, res) => {
  res.json({
    status: 'ok',
    service: 'MedASR Proxy',
    configured: !!RUNPOD_API_KEY
  });
});
