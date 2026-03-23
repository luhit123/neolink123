// @ts-nocheck
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});

// Close server after all tests
afterAll(() => server.close());

// Mock Firebase - the core config module
vi.mock('../firebaseConfig', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'test-user-123',
      email: 'test@hospital-a.com'
    }
  },
  app: {},
  functions: {},
  googleProvider: {},
  authReady: Promise.resolve(),
  pendingRedirectResult: Promise.resolve(null),
  getAnalyticsInstance: vi.fn()
}));

// Mock Firebase Auth module
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      uid: 'test-user-123',
      email: 'test@hospital-a.com'
    }
  })),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback({
      uid: 'test-user-123',
      email: 'test@hospital-a.com'
    });
    return vi.fn(); // unsubscribe
  }),
  GoogleAuthProvider: vi.fn(),
  browserLocalPersistence: {},
  setPersistence: vi.fn(),
  getRedirectResult: vi.fn(() => Promise.resolve(null)),
  signInWithRedirect: vi.fn(),
  signInWithPopup: vi.fn()
}));

// Mock Firebase Firestore module
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  endBefore: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date }))
  },
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  getFirestore: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve())
  })),
  runTransaction: vi.fn()
}));

// Mock Firebase Functions module
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: {} }))),
  connectFunctionsEmulator: vi.fn()
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: []
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock window.scrollTo
window.scrollTo = vi.fn();

// Mock localStorage with actual storage functionality
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null)
  };
};
const localStorageMock = createStorageMock();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage with its own storage
const sessionStorageMock = createStorageMock();
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock crypto.randomUUID for Node.js environment
if (!global.crypto) {
  global.crypto = {} as Crypto;
}
if (!(global.crypto as Crypto).randomUUID) {
  (global.crypto as Crypto).randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }) as `${string}-${string}-${string}-${string}-${string}`;
}

// Mock Audio for voice-related tests
window.AudioContext = vi.fn().mockImplementation(() => ({
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteFrequencyData: vi.fn()
  })),
  createMediaStreamSource: vi.fn(() => ({
    connect: vi.fn()
  })),
  close: vi.fn()
}));

// Mock MediaRecorder
global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: vi.fn(),
  state: 'inactive'
}));

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    }),
    enumerateDevices: vi.fn().mockResolvedValue([])
  }
});

// Suppress console errors for cleaner test output (optional - comment out for debugging)
// const originalError = console.error;
// console.error = (...args: any[]) => {
//   if (
//     typeof args[0] === 'string' &&
//     args[0].includes('Warning: ReactDOM.render is no longer supported')
//   ) {
//     return;
//   }
//   originalError.call(console, ...args);
// };
