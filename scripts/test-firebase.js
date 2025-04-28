const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFirestore() {
  try {
    console.log('Testing Firestore connection...');
    console.log('Using project ID:', firebaseConfig.projectId);
    
    // Try to read the class we just created
    const classRef = doc(db, 'classes', 'AV7NTKJnp5xDMuzQ5Ou3');
    const docSnap = await getDoc(classRef);
    
    if (docSnap.exists()) {
      console.log('Successfully read class data:', docSnap.data());
      return true;
    } else {
      console.log('Class document does not exist');
      return false;
    }
  } catch (error) {
    console.error('Error testing Firestore:', error);
    return false;
  }
}

testFirestore(); 