import { http, HttpResponse } from 'msw';

/**
 * MSW Request Handlers for NeoLink PICU/NICU Medical Records System
 * These handlers mock external API calls during testing
 */
export const handlers = [
  // ============ OpenAI API Mocks ============
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      id: 'chatcmpl-mock-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Mock AI response for clinical documentation assistance.'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 25,
        total_tokens: 75
      }
    });
  }),

  // ============ Google Gemini API Mocks ============
  http.post('https://generativelanguage.googleapis.com/*', () => {
    return HttpResponse.json({
      candidates: [{
        content: {
          parts: [{
            text: 'Mock Gemini AI response for medical query.'
          }],
          role: 'model'
        },
        finishReason: 'STOP',
        index: 0
      }]
    });
  }),

  // ============ Deepgram API Mocks ============
  http.post('https://api.deepgram.com/v1/listen', () => {
    return HttpResponse.json({
      results: {
        channels: [{
          alternatives: [{
            transcript: 'Mock transcription of clinical notes',
            confidence: 0.95,
            words: [
              { word: 'Mock', start: 0, end: 0.3, confidence: 0.99 },
              { word: 'transcription', start: 0.4, end: 0.8, confidence: 0.95 }
            ]
          }]
        }]
      },
      metadata: {
        transaction_key: 'mock-transaction',
        request_id: 'mock-request-id'
      }
    });
  }),

  // ============ ElevenLabs API Mocks ============
  http.post('https://api.elevenlabs.io/*', () => {
    return HttpResponse.json({
      text: 'Mock transcription from ElevenLabs STT',
      words: []
    });
  }),

  // ============ RunPod API Mocks (for Faster Whisper) ============
  http.post('/api/runpod/*', () => {
    return HttpResponse.json({
      delayTime: 100,
      executionTime: 500,
      id: 'mock-runpod-job',
      output: {
        transcription: 'Mock RunPod Whisper transcription'
      },
      status: 'COMPLETED'
    });
  }),

  // ============ Firebase Cloud Functions Mocks ============
  http.post('*/chatWithAI', () => {
    return HttpResponse.json({
      data: {
        response: 'Mock response from Cloud Function'
      }
    });
  }),

  http.post('*/lookupUser', () => {
    return HttpResponse.json({
      data: {
        found: true,
        user: {
          uid: 'mock-uid-123',
          email: 'doctor@hospital-a.com',
          displayName: 'Dr. Test User'
        }
      }
    });
  }),

  // ============ Supabase API Mocks ============
  http.post('https://*.supabase.co/rest/v1/*', () => {
    return HttpResponse.json([]);
  }),

  http.get('https://*.supabase.co/rest/v1/*', () => {
    return HttpResponse.json([]);
  }),

  http.patch('https://*.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({});
  }),

  // ============ Error Simulation Handlers ============
  // These can be overridden in specific tests using server.use()

  // Handler for testing network errors
  http.post('*/simulate-network-error', () => {
    return HttpResponse.error();
  }),

  // Handler for testing 500 errors
  http.post('*/simulate-server-error', () => {
    return new HttpResponse(null, {
      status: 500,
      statusText: 'Internal Server Error'
    });
  }),

  // Handler for testing 401 unauthorized
  http.post('*/simulate-unauthorized', () => {
    return new HttpResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }),

  // Handler for testing rate limiting
  http.post('*/simulate-rate-limit', () => {
    return new HttpResponse(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60'
      }
    });
  })
];

// Helper to create custom handlers for specific test scenarios
export const createMockPatientHandler = (patients: any[]) => {
  return http.get('*/patients*', () => {
    return HttpResponse.json(patients);
  });
};

export const createMockUserHandler = (user: any) => {
  return http.get('*/users/*', () => {
    return HttpResponse.json(user);
  });
};

export const createMockErrorHandler = (url: string, status: number, message: string) => {
  return http.all(url, () => {
    return new HttpResponse(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  });
};
