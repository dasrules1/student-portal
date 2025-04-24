import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';

// Set default values for development if environment variables are missing
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDemoApiKeyForDevelopmentOnly",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://demo-project.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:abcd1234efgh5678",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-ABCD1234EF"
};

// Check if Firebase is being used in build/SSR context vs client context
const isServerSideRendering = typeof window === 'undefined';

// Handle errors gracefully and provide fallbacks during build/SSR
let app, auth, db, storage, analytics, realtimeDb;

try {
  // Initialize Firebase
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  // Only initialize these in browser context
  if (!isServerSideRendering) {
    analytics = getAnalytics(app);
    realtimeDb = getDatabase(app);
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  
  // Provide mock objects during SSR/builds to prevent crashes
  if (isServerSideRendering) {
    // These mock objects will be replaced with real ones on the client
    auth = { currentUser: null } as any;
    db = {} as any;
    storage = {} as any;
    analytics = null;
    realtimeDb = {} as any;
  }
}

export { app, auth, db, storage, analytics, realtimeDb }; 