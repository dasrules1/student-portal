import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  UserCredential,
  Auth
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  } else {
    app = getApp();
    console.log('Using existing Firebase app');
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  
  // Log the auth domain to verify configuration
  console.log('Firebase Auth Domain:', auth.config.authDomain);
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw error;
}

export interface UserSession {
  user: User | null;
  role: 'student' | 'teacher' | 'admin' | null;
  error?: string;
}

export const firebaseAuth = {
  // Sign in with email and password
  async signIn(email: string, password: string, role?: 'student' | 'teacher' | 'admin'): Promise<UserSession> {
    try {
      console.log('Firebase config:', {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
      });
      
      console.log('Attempting to sign in with email:', email, 'and role:', role);
      
      // First try to sign in
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('Sign in successful, user:', user);
        
        // Get user role from Firestore
        console.log('Fetching user role from Firestore for user:', user.uid);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        console.log('User data from Firestore:', userData);
        
        if (!userData) {
          console.log('No user data found in Firestore, creating user document...');
          // Create user document in Firestore if it doesn't exist
          const newUserData = {
            id: user.uid,
            email: user.email,
            name: user.displayName || email.split('@')[0].replace(/[._]/g, ' '),
            role: role || 'student', // Use provided role or default to student
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await setDoc(doc(db, 'users', user.uid), newUserData);
          console.log('Created user document in Firestore:', newUserData);
          
          return {
            user,
            role: role || 'student'
          };
        }
        
        // If role is provided and different from stored role, update it
        if (role && userData.role !== role) {
          console.log('Updating user role from', userData.role, 'to', role);
          await setDoc(doc(db, 'users', user.uid), {
            ...userData,
            role: role,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          return {
            user,
            role: role
          };
        }
        
        return {
          user,
          role: userData.role || null
        };
      } catch (error: any) {
        console.error('Sign in error details:', {
          code: error.code,
          message: error.message,
          fullError: error,
          authDomain: auth.config.authDomain,
          currentUser: auth.currentUser
        });
        
        // Handle specific error cases
        if (error.code === 'auth/wrong-password') {
          throw new Error('Incorrect password. Please try again.');
        } else if (error.code === 'auth/too-many-requests') {
          throw new Error('Too many failed attempts. Please try again later.');
        } else if (error.code === 'auth/network-request-failed') {
          throw new Error('Network error. Please check your connection.');
        } else if (error.code === 'auth/invalid-email') {
          throw new Error('Invalid email format.');
        } else if (error.code === 'auth/operation-not-allowed') {
          throw new Error('Email/password accounts are not enabled. Please contact support.');
        } else if (error.code === 'auth/invalid-credential') {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        }
        
        throw error;
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      return {
        user: null,
        role: null,
        error: error.message
      };
    }
  },

  // Create user if they don't exist
  async createUserIfNotExists(email: string, password: string, role: 'student' | 'teacher' | 'admin'): Promise<UserSession> {
    try {
      // Create the auth user
      const userCredential = await firebaseCreateUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Created new user:', user);

      // Extract name from email
      const name = email.split('@')[0].replace(/[._]/g, ' ');

      // Update profile with name
      await updateProfile(user, { displayName: name });
      console.log('Updated user profile with name:', name);

      // Create user document in Firestore with specified role
      const userData = {
        id: user.uid,
        email,
        name,
        role: role, // Use the provided role
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', user.uid), userData);
      console.log('Created user document in Firestore:', userData);

      return {
        user,
        role: role
      };
    } catch (error: any) {
      console.error('Error creating user:', error);
      return {
        user: null,
        role: null,
        error: error.message
      };
    }
  },

  // Sign up with email and password
  async signUp(email: string, password: string, name: string, role: 'student' | 'teacher' | 'admin'): Promise<{ success: boolean; error?: string; userId?: string }> {
    try {
      // Create the auth user
      const userCredential = await firebaseCreateUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update profile with name
      await updateProfile(user, { displayName: name });

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        email,
        name,
        role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Send email verification
      await sendEmailVerification(user);

      return { success: true, userId: user.uid };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  },

  // Sign out
  async signOut(): Promise<boolean> {
    try {
      await firebaseSignOut(auth);
      return true;
    } catch (error) {
      console.error('Sign out error:', error);
      return false;
    }
  },

  // Send password reset email
  async sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error: any) {
      console.error('Password reset error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get current user session
  async getCurrentUser(): Promise<UserSession> {
    const user = auth.currentUser;
    if (!user) {
      return { user: null, role: null };
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      return {
        user,
        role: userData?.role || null
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return { user: null, role: null };
    }
  },

  // Update user profile
  async updateUserProfile(userId: string, data: { name?: string; role?: string }): Promise<{ success: boolean; error?: string }> {
    try {
      await setDoc(doc(db, 'users', userId), {
        ...data,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      if (data.name && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: data.name });
      }

      return { success: true };
    } catch (error: any) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  },

  // Create a test user for debugging
  async createTestUser(email: string, password: string): Promise<UserSession> {
    try {
      console.log('Creating test user with email:', email);
      
      // First try to sign in to see if user exists
      try {
        const existingUser = await signInWithEmailAndPassword(auth, email, password);
        console.log('User already exists:', existingUser.user.uid);
        return {
          user: existingUser.user,
          role: 'student'
        };
      } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
      }
      
      // Create new user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Created new test user:', user.uid);
      
      // Create user document in Firestore
      const userData = {
        id: user.uid,
        email: user.email,
        name: email.split('@')[0].replace(/[._]/g, ' '),
        role: 'student',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', user.uid), userData);
      console.log('Created user document in Firestore:', userData);
      
      return {
        user,
        role: 'student'
      };
    } catch (error: any) {
      console.error('Error creating test user:', error);
      return {
        user: null,
        role: null,
        error: error.message
      };
    }
  }
};

export { auth, db }; 