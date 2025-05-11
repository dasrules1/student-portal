// Update admin user profile script

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } = require('firebase/firestore');
const { getAuth, updateProfile } = require('firebase/auth');

// Firebase configuration
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
const auth = getAuth(app);

// New admin information
const adminInfo = {
  name: 'Dylan Sood',
  email: 'dylan.sood@educationmore.org'
};

async function updateAdminProfile() {
  try {
    console.log('Searching for admin user...');
    
    // Query for admin users
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'admin'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('No admin users found.');
      return;
    }
    
    // Update each admin user (should be just one)
    let updated = false;
    
    for (const docSnapshot of querySnapshot.docs) {
      const userId = docSnapshot.id;
      console.log(`Updating admin user with ID: ${userId}`);
      
      // Update in Firestore
      await updateDoc(doc(db, 'users', userId), {
        name: adminInfo.name,
        email: adminInfo.email,
        updatedAt: new Date().toISOString()
      });
      
      console.log('Admin profile updated in Firestore');
      updated = true;
      
      // Also update localStorage if you're running in a browser environment
      if (typeof window !== 'undefined') {
        const storageKey = 'educationmore_users';
        try {
          const usersJson = localStorage.getItem(storageKey);
          if (usersJson) {
            const users = JSON.parse(usersJson);
            const updatedUsers = users.map(user => {
              if (user.role === 'admin') {
                return {
                  ...user,
                  name: adminInfo.name,
                  email: adminInfo.email
                };
              }
              return user;
            });
            localStorage.setItem(storageKey, JSON.stringify(updatedUsers));
            console.log('Admin profile also updated in localStorage');
          }
        } catch (err) {
          console.log('Failed to update localStorage, browser-only feature');
        }
      }
    }
    
    if (updated) {
      console.log('Admin profile update completed successfully');
    } else {
      console.log('No changes were made');
    }
  } catch (error) {
    console.error('Error updating admin profile:', error);
  }
}

// Run the update function
updateAdminProfile(); 