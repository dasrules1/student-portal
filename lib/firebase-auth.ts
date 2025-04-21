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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user role from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      return {
        user,
        role: userData?.role || null
      };
    } catch (error: any) {
      console.error('Sign in error:', error);
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
  }
}; 