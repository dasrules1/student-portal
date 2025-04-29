import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User,
  UserCredential
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface UserSession {
  user: User | null;
  role: 'student' | 'teacher' | 'admin' | null;
  error?: string;
}

export const firebaseAuth = {
  // Sign in with email and password
  async signIn(email: string, password: string): Promise<UserSession> {
    try {
      console.log('Attempting to sign in with email:', email);
      
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
            role: 'student', // Default role
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await setDoc(doc(db, 'users', user.uid), newUserData);
          console.log('Created user document in Firestore:', newUserData);
          
          return {
            user,
            role: 'student'
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
          fullError: error
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
  async createUserIfNotExists(email: string, password: string): Promise<UserSession> {
    try {
      // Create the auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Created new user:', user);

      // Extract name from email
      const name = email.split('@')[0].replace(/[._]/g, ' ');

      // Update profile with name
      await updateProfile(user, { displayName: name });
      console.log('Updated user profile with name:', name);

      // Create user document in Firestore
      const userData = {
        id: user.uid,
        email,
        name,
        role: 'student', // Default role
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
      await signOut(auth);
      return true;
    } catch (error) {
      console.error('Sign out error:', error);
      return false;
    }
  },

  // Send password reset email
  async sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      await sendPasswordResetEmail(auth, email);
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

  // Create test user if it doesn't exist
  async createTestUser(): Promise<{ success: boolean; error?: string }> {
    try {
      const testEmail = 'test@example.com';
      const testPassword = 'test123';
      
      // Try to sign in first to check if user exists
      try {
        await signInWithEmailAndPassword(auth, testEmail, testPassword);
        console.log('Test user already exists');
        return { success: true };
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // Create the user if it doesn't exist
          console.log('Creating test user...');
          const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
          const user = userCredential.user;
          
          // Create user document in Firestore
          await setDoc(doc(db, 'users', user.uid), {
            id: user.uid,
            email: testEmail,
            name: 'Test User',
            role: 'student',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          
          console.log('Test user created successfully');
          return { success: true };
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error creating test user:', error);
      return { success: false, error: error.message };
    }
  }
}; 