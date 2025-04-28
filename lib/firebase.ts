import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getDatabase, Database, connectDatabaseEmulator } from 'firebase/database';

// Set default values for development if environment variables are missing
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCEJLDvNCGQzYKdsEB8B9uCgm_AORADjYw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "backend-education-more.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://backend-education-more-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "backend-education-more",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "backend-education-more.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "531115842111",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:531115842111:web:d2c2c477fc8693e29eb68a",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-1HG47JHZ10"
};

// Check if Firebase is being used in build/SSR context vs client context
const isServerSideRendering = typeof window === 'undefined';

// Initialize Firebase services
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | null;
let realtimeDb: Database;

try {
  // Initialize Firebase
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
  } else {
    app = getApps()[0];
    console.log("Using existing Firebase app");
  }

  // Initialize services
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  // Only initialize these in browser context
  if (!isServerSideRendering) {
    try {
      analytics = getAnalytics(app);
      realtimeDb = getDatabase(app);
      console.log("Firebase services initialized successfully");
    } catch (error) {
      console.error("Error initializing Firebase services:", error);
      analytics = null;
      realtimeDb = getDatabase(app);
    }
  } else {
    // Provide mock objects during SSR/builds
    analytics = null;
    realtimeDb = getDatabase(app);
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  
  // Provide mock objects during SSR/builds to prevent crashes
  if (isServerSideRendering) {
    auth = {} as Auth;
    db = {} as Firestore;
    storage = {} as FirebaseStorage;
    analytics = null;
    realtimeDb = {} as Database;
  } else {
    // In client context, rethrow the error to prevent silent failures
    throw error;
  }
}

export { app, auth, db, storage, analytics, realtimeDb }; 