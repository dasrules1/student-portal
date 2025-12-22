// @ts-nocheck
// Storage service for client-side data management

// Type declarations for external modules to suppress errors
// @ts-ignore
import { PersistentStorage, persistentStorage } from "./persistentStorage"
// @ts-ignore
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  StorageReference,
  FirebaseStorage
} from 'firebase/storage';
// @ts-ignore
import { storage as firebaseStorage, db, auth } from './firebase';
// @ts-ignore
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  DocumentData,
  setDoc,
  QueryDocumentSnapshot,
  DocumentReference,
  writeBatch,
  getFirestore
} from 'firebase/firestore';
// Import Firebase Auth functionality
import { firebaseAuth } from './firebase-auth';
import { createUserWithEmailAndPassword, updateProfile, getAuth } from 'firebase/auth';

// Import types from shared types file
import type { User, Class, ActivityLog, Submission, UploadResult, FileMetadata, Curriculum } from "./types"

class StorageService {
  private users: User[] = []
  private classes: Class[] = []
  private activityLogs: ActivityLog[] = []

  constructor() {
    // Debug PersistentStorage import
    console.log("StorageService constructor - PersistentStorage:", PersistentStorage);
    console.log("StorageService constructor - persistentStorage instance:", persistentStorage);
    console.log("StorageService constructor - typeof PersistentStorage:", typeof PersistentStorage);
    if (PersistentStorage && typeof PersistentStorage.getInstance === 'function') {
      console.log("StorageService constructor - PersistentStorage.getInstance is available");
    } else {
      console.error("StorageService constructor - PersistentStorage.getInstance is NOT available");
    }
    if (persistentStorage) {
      console.log("StorageService constructor - persistentStorage instance is available");
    } else {
      console.error("StorageService constructor - persistentStorage instance is NOT available");
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      console.log("Getting users from Firestore...")
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      if (!snapshot || !snapshot.docs) {
        console.warn("No snapshot or docs found in Firestore");
        // Return from localStorage
        try {
          if (PersistentStorage && typeof PersistentStorage.getInstance === 'function') {
            const localUsers = PersistentStorage.getInstance().getAllUsers();
        this.users = Array.isArray(localUsers) ? localUsers : [];
        return this.users;
          } else {
            console.error("PersistentStorage not available, using empty array");
            this.users = [];
            return [];
          }
        } catch (error) {
          console.error("Error accessing PersistentStorage:", error);
          this.users = [];
          return [];
        }
      }
      
      const loadedUsers = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
        const data = doc.data();
        return { 
          id: doc.id, 
          name: data.name || '', 
          email: data.email || '', 
          password: data.password || '', 
          role: data.role || 'student',
          status: data.status || 'active',
          avatar: data.avatar || '',
          classes: data.classes || []
        } as User;
      });
      
      // Cache the users locally (ensure it's an array)
      this.users = Array.isArray(loadedUsers) ? loadedUsers : [];
      console.log(`Loaded ${this.users.length} users from Firestore`, this.users);
      return this.users;
    } catch (error) {
      console.error('Error getting users:', error);
      // Fallback to localStorage
      try {
        const localUsers = PersistentStorage.getInstance().getAllUsers();
        // Make sure we always return an array
        const safeUsers = Array.isArray(localUsers) ? localUsers : [];
        console.log('Falling back to local storage users:', safeUsers);
        this.users = safeUsers;
        return safeUsers;
      } catch (backupError) {
        console.error('Critical error getting users from all sources:', backupError);
        // Ultimate fallback - empty array
        this.users = [];
      return [];
      }
    }
  }

  getUserById(id: string): User | undefined {
    try {
      // Try to find in the local cache first
      const localUser = this.users.find(user => user.id === id);
      if (localUser) return localUser;
      
      // Try to get from persistent storage
      try {
        // Only use persistentStorage if it's available
        if (typeof PersistentStorage.getInstance() !== 'undefined') {
          const user = PersistentStorage.getInstance().getUserById(id);
          if (user) return user;
        }
      } catch (error) {
        console.error('Error getting user from persistentStorage:', error);
      }
      
      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        try {
          // Try to get from localStorage
          const usersJson = localStorage.getItem('users');
          if (usersJson) {
            const users = JSON.parse(usersJson);
            if (Array.isArray(users)) {
              const user = users.find(u => u.id === id);
              if (user) return user;
            }
          }
          
          // Also check for individual user in localStorage
          const userJson = localStorage.getItem(`user-${id}`);
          if (userJson) {
            return JSON.parse(userJson);
          }
          
          // Check for currentUser if the ID matches
          const currentUserJson = localStorage.getItem('currentUser');
          if (currentUserJson) {
            const currentUser = JSON.parse(currentUserJson);
            if (currentUser && currentUser.id === id) {
              return currentUser;
            }
          }
        } catch (localStorageError) {
          console.error('Error getting user from localStorage:', localStorageError);
        }
      }
      
      console.warn(`User with ID ${id} not found in any storage`);
      return undefined;
    } catch (error) {
      console.error('Error getting user from storage:', error);
      return undefined;
    }
  }

  getUserByEmail(email: string): User | undefined {
    try {
      console.log(`Getting user by email: ${email}`);
      
      // Try to find in the local cache first
      const localUser = this.users.find(user => user.email === email);
      if (localUser) {
        console.log(`User found in cache: ${localUser.id}`);
        return localUser;
      }
      
      // If not found in cache, try localStorage
      try {
        console.log('Checking localStorage for user by email');
        const localStorageUsers = localStorage.getItem('users');
        if (localStorageUsers) {
          const users = JSON.parse(localStorageUsers);
          if (Array.isArray(users)) {
            const user = users.find(u => u.email === email);
            if (user) {
              console.log(`User found in localStorage: ${user.id}`);
              // Update the cache
              this.users.push(user);
              return user;
            }
          }
        }
      } catch (localStorageError) {
        console.warn('Error getting user from localStorage:', localStorageError);
      }
      
      console.warn(`User with email ${email} not found in any storage`);
      return undefined;
    } catch (error) {
      console.error('Error getting user by email from storage:', error);
      return undefined;
    }
  }

  // Add a synchronous version for compatibility with UI components
  getAllUsers(): User[] {
    console.log("getAllUsers called - providing cached users");
    
    // If we don't have users in cache, try to load them from localStorage
    if (!this.users || this.users.length === 0) {
      try {
        console.log("No users in cache, attempting to retrieve from localStorage");
        const localStorageUsers = localStorage.getItem('users');
        if (localStorageUsers) {
          const parsedUsers = JSON.parse(localStorageUsers);
          if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
            console.log(`Found ${parsedUsers.length} users in localStorage`);
            this.users = [...parsedUsers];
            return [...parsedUsers];
          }
        }
      } catch (error) {
        console.error("Error in getAllUsers from localStorage:", error);
      }
    }
    
    // Return cached users if they're available now
    if (this.users && Array.isArray(this.users) && this.users.length > 0) {
      return [...this.users];
    }
    
    console.warn("No users available in cache or localStorage, returning empty array");
    return [];
  }

  async addUser(userData: Omit<User, "id">): Promise<User> {
    try {
      console.log("Adding user to Firestore:", userData);
      
      // Generate avatar initials
      const avatarInitials = userData.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
        
      // Add status and avatar if not provided
      const enhancedUserData = {
        ...userData,
        status: userData.status || 'active',
        avatar: userData.avatar || avatarInitials,
        classes: userData.classes || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // First, create the user in Firebase Authentication
      let authUserId = '';
      try {
        // Create the authentication user
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const authUser = userCredential.user;
        authUserId = authUser.uid;
        
        // Update the user's display name
        await updateProfile(authUser, {
          displayName: userData.name
        });
        
        console.log('User created in Firebase Auth with ID:', authUserId);
      } catch (authError) {
        console.error('Error creating user in Firebase Auth:', authError);
        // If the user already exists in Firebase Auth, continue with Firestore update
        if (authError.code === 'auth/email-already-in-use') {
          console.log('User already exists in Firebase Auth, continuing with Firestore update');
        } else {
          throw authError;
        }
      }
      
      // Add to Firestore using the Firebase Auth UID if available
      let firestoreId = authUserId;
      if (!firestoreId) {
        // If Firebase Auth creation failed, generate a new ID for Firestore
        const usersRef = collection(db, 'users');
        const docRef = await addDoc(usersRef, enhancedUserData);
        firestoreId = docRef.id;
      } else {
        // Use the Firebase Auth UID for Firestore document ID
        await setDoc(doc(db, 'users', authUserId), enhancedUserData);
      }
      
      const newUser = { id: firestoreId, ...enhancedUserData } as User;
      
      console.log('User created in Firestore with ID:', firestoreId);
      
      // Update local cache
      this.users.push(newUser);
      
      // Also add to localStorage as backup
      try {
        // Get existing users from localStorage
        const localStorageUsers = localStorage.getItem('users');
        let users = [];
        if (localStorageUsers) {
          users = JSON.parse(localStorageUsers);
        }
        
        // Make sure it's an array
        if (!Array.isArray(users)) {
          users = [];
        }
        
        // Add the new user
        users.push(newUser);
        
        // Save back to localStorage
        localStorage.setItem('users', JSON.stringify(users));
        console.log('User added to localStorage as backup');
      } catch (e) {
        console.log('Error adding user to localStorage:', e);
      }
      
      console.log('User added successfully:', newUser);
      return newUser;
    } catch (error) {
      console.error('Error adding user to Firestore:', error);
      // Try to add to localStorage as fallback
      try {
        // Generate a local ID
        const localId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Create the user with generated ID
        const localUser = { 
          id: localId, 
          ...userData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString() 
        } as User;
        
        // Get existing users from localStorage
        const localStorageUsers = localStorage.getItem('users');
        let users = [];
        if (localStorageUsers) {
          users = JSON.parse(localStorageUsers);
        }
        
        // Make sure it's an array
        if (!Array.isArray(users)) {
          users = [];
        }
        
        // Add the new user
        users.push(localUser);
        
        // Save back to localStorage
        localStorage.setItem('users', JSON.stringify(users));
        
        // Update local cache
        this.users.push(localUser);
        
        console.log('User added to local storage as fallback:', localUser);
        return localUser;
      } catch (e) {
        console.error('Failed to add user to local storage too:', e);
        throw error;
      }
    }
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User | undefined> {
    try {
      console.log(`Updating user ${id} with data:`, userData);
      
      // Update in Firestore
      const userRef = doc(db, 'users', id);
      
      // Add updatedAt timestamp
      const updatedData = {
        ...userData,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(userRef, updatedData);
      
      // Update local cache
      const index = this.users.findIndex(user => user.id === id);
      if (index !== -1) {
        this.users[index] = { ...this.users[index], ...updatedData };
      }
      
      // Also update in localStorage
      try {
        // Get users from localStorage
        const localStorageUsers = localStorage.getItem('users');
        if (localStorageUsers) {
          const users = JSON.parse(localStorageUsers);
          if (Array.isArray(users)) {
            // Find and update the user
            const userIndex = users.findIndex(u => u.id === id);
            if (userIndex !== -1) {
              users[userIndex] = { ...users[userIndex], ...updatedData };
              // Save back to localStorage
              localStorage.setItem('users', JSON.stringify(users));
              console.log(`User ${id} updated in localStorage`);
            }
          }
        }
      } catch (localStorageError) {
        console.warn('Error updating user in localStorage:', localStorageError);
      }
      
      console.log('User updated successfully:', id);
      return index !== -1 ? this.users[index] : undefined;
    } catch (error) {
      console.error('Error updating user in Firestore:', error);
      
      // Try to update in localStorage as fallback
      try {
        // Get users from localStorage
        const localStorageUsers = localStorage.getItem('users');
        if (localStorageUsers) {
          const users = JSON.parse(localStorageUsers);
          if (Array.isArray(users)) {
            // Find and update the user
            const userIndex = users.findIndex(u => u.id === id);
            if (userIndex !== -1) {
              // Add updatedAt timestamp
              const updatedData = {
                ...userData,
                updatedAt: new Date().toISOString()
              };
              
              // Update the user
              users[userIndex] = { ...users[userIndex], ...updatedData };
              
              // Save back to localStorage
              localStorage.setItem('users', JSON.stringify(users));
              
              // Update local cache
              const cacheIndex = this.users.findIndex(user => user.id === id);
              if (cacheIndex !== -1) {
                this.users[cacheIndex] = { ...this.users[cacheIndex], ...updatedData };
                console.log(`User ${id} updated in cache and localStorage`);
                return this.users[cacheIndex];
              } else {
                console.log(`User ${id} updated in localStorage only`);
                return users[userIndex] as User;
              }
            }
          }
        }
        console.warn(`User ${id} not found in localStorage`);
        return undefined;
      } catch (localStorageError) {
        console.error('Failed to update user in localStorage too:', localStorageError);
        return undefined;
      }
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      console.log(`Deleting user with ID: ${id}`);
      
      // Delete from Firestore
      const userRef = doc(db, 'users', id);
      await deleteDoc(userRef);
      
      // Update local cache
      const initialLength = this.users.length;
      this.users = this.users.filter(user => user.id !== id);
      
      // Also delete from localStorage
      try {
        // Get users from localStorage
        const localStorageUsers = localStorage.getItem('users');
        if (localStorageUsers) {
          let users = JSON.parse(localStorageUsers);
          if (Array.isArray(users)) {
            // Filter out the user
            const initialLocalLength = users.length;
            users = users.filter(u => u.id !== id);
            
            // Save back to localStorage
            localStorage.setItem('users', JSON.stringify(users));
            
            console.log(`User ${id} ${initialLocalLength > users.length ? 'deleted from' : 'not found in'} localStorage`);
          }
        }
      } catch (localStorageError) {
        console.warn('Error deleting user from localStorage:', localStorageError);
      }
      
      console.log('User deleted successfully:', id);
      return this.users.length < initialLength;
    } catch (error) {
      console.error('Error deleting user from Firestore:', error);
      
      // Try to delete from localStorage as fallback
      try {
        // Get users from localStorage
        const localStorageUsers = localStorage.getItem('users');
        if (localStorageUsers) {
          let users = JSON.parse(localStorageUsers);
          if (Array.isArray(users)) {
            // Check if user exists
            const initialLocalLength = users.length;
            
            // Filter out the user
            users = users.filter(u => u.id !== id);
            
            // Save back to localStorage
            localStorage.setItem('users', JSON.stringify(users));
            
            // Also remove from cache
            const initialCacheLength = this.users.length;
            this.users = this.users.filter(user => user.id !== id);
            
            const wasDeleted = initialLocalLength > users.length || initialCacheLength > this.users.length;
            console.log(`User ${id} ${wasDeleted ? 'deleted from' : 'not found in'} localStorage or cache`);
            return wasDeleted;
          }
        }
        return false;
      } catch (localStorageError) {
        console.error('Failed to delete user from localStorage too:', localStorageError);
        return false;
      }
    }
  }

  // Classes
  async getClasses(): Promise<Class[]> {
    try {
      // Create a safe fallback array
      const fallbackClasses: Class[] = [];
      
      // Try to load from Firestore
      try {
        console.log("Getting classes from Firestore...");
        const classesRef = collection(db, 'classes');
        const snapshot = await getDocs(classesRef);
        
        if (snapshot && snapshot.docs && Array.isArray(snapshot.docs) && snapshot.docs.length > 0) {
          console.log(`Retrieved ${snapshot.docs.length} classes from Firestore`);
          
          const classesWithData = [];
          // Use for loop instead of map for better error handling
          for (let i = 0; i < snapshot.docs.length; i++) {
            try {
              const doc = snapshot.docs[i];
              if (doc && typeof doc.data === 'function') {
                const data = doc.data();
                classesWithData.push({
                  id: doc.id,
                  name: data.name || '',
                  teacher: data.teacher || 'Unknown Teacher',
                  location: data.location || '',
                  meetingDates: data.meetingDates || '',
                  startDate: data.startDate || '',
                  endDate: data.endDate || '',
                  startTime: data.startTime || '',
                  endTime: data.endTime || '',
                  virtualLink: data.virtualLink || '',
                  status: data.status || 'active',
                  students: data.students || 0,
                  enrolledStudents: data.enrolledStudents || [],
                  subject: data.subject || '',
                  meeting_day: data.meeting_day || ''
                });
              }
            } catch (docError) {
              console.error("Error processing class document:", docError);
            }
          }
          
          if (classesWithData.length > 0) {
            // Cache classes locally
            this.classes = classesWithData;
            return [...classesWithData]; // Return a new copy
          }
        }
      } catch (firestoreError) {
        console.error("Error fetching classes from Firestore:", firestoreError);
      }

      // Fall back to local storage
      try {
        const localClasses = PersistentStorage.getInstance().getAllClasses();
        if (localClasses && Array.isArray(localClasses) && localClasses.length > 0) {
          console.log('Using local storage classes:', localClasses);
          this.classes = [...localClasses];
          return [...localClasses]; // Return a new copy
        }
      } catch (localError) {
        console.error("Error getting classes from local storage:", localError);
      }
      
      // If everything failed, return an empty array
      console.log('No classes found, returning empty array');
      this.classes = [];
      return [];
    } catch (error) {
      console.error("Critical error in getClasses:", error);
      // Last resort fallback
      this.classes = [];
      return [];
    }
  }
  
  // Add a synchronous version for compatibility
  getAllClasses(): Class[] {
    console.log("getAllClasses called - providing cached classes");
    
    // If we don't have classes in cache, try to load them from persistent storage first
    if (!this.classes || this.classes.length === 0) {
      try {
        const localClasses = PersistentStorage.getInstance().getAllClasses();
        if (localClasses && Array.isArray(localClasses) && localClasses.length > 0) {
          this.classes = [...localClasses];
          return [...localClasses];
        }
      } catch (error) {
        console.error("Error in getAllClasses from persistent storage:", error);
      }
    }
    
    // Return cached classes if they're available now
    if (this.classes && Array.isArray(this.classes) && this.classes.length > 0) {
      return [...this.classes];
    }
    
    console.warn("No classes available in cache, returning empty array");
    return [];
  }

  // Safe wrapper for UI components
  async getSafeClasses(): Promise<Class[]> {
    try {
      const classes = await this.getClasses();
      // Ensure it's a valid array
      if (classes && Array.isArray(classes)) {
        return classes;
      } else {
        console.error("getClasses returned non-array, using empty array");
        return [];
      }
    } catch (error) {
      console.error("Error in getSafeClasses:", error);
      return [];
    }
  }

  async getClassById(id: string): Promise<Class | undefined> {
    try {
      console.log(`Looking for class with ID: ${id}`);
      
      // First check the local cache
      const localClass = this.classes.find(cls => cls.id === id);
      if (localClass) {
        console.log(`Found class in local cache: ${id}`);
        return localClass;
      }
      
      console.log(`Class not found in local cache, trying Firestore: ${id}`);
      // Then try to get from Firestore
      try {
        const classRef = doc(db, 'classes', id);
        const docSnap = await getDoc(classRef);
        
        if (docSnap.exists()) {
          const classData = { id: docSnap.id, ...(docSnap.data() as Omit<Class, 'id'>) } as Class;
          console.log(`Found class in Firestore: ${id}`);
          
          // Update local cache with this class
          const existingIndex = this.classes.findIndex(c => c.id === id);
          if (existingIndex >= 0) {
            this.classes[existingIndex] = classData;
          } else {
            this.classes.push(classData);
          }
          
          return classData;
        }
      } catch (firestoreError) {
        console.error(`Error getting class from Firestore: ${id}`, firestoreError);
      }
      
      console.log(`Class not found in Firestore, trying persistent storage: ${id}`);
      // Try to fall back to persistent storage
      return PersistentStorage.getInstance().getClassById(id);
    } catch (error) {
      console.error(`Error in getClassById for ${id}:`, error);
      return PersistentStorage.getInstance().getClassById(id);
    }
  }

  async addClass(classData: Omit<Class, "id">): Promise<Class> {
    try {
      console.log("Adding class to Firestore:", classData);
      
      // Prepare data for Firestore
      const enhancedClassData = {
        ...classData,
        status: classData.status || 'active',
        students: classData.students || 0,
        enrolledStudents: classData.enrolledStudents || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add to Firestore
      const classesRef = collection(db, 'classes');
      const docRef = await addDoc(classesRef, enhancedClassData);
      const newClass = { id: docRef.id, ...enhancedClassData } as Class;
      
      console.log('Class created in Firestore with ID:', docRef.id);
      
      // Update local cache
      this.classes.push(newClass);
      
      // Also add to persistent storage as backup
      try {
        PersistentStorage.getInstance().addClass(enhancedClassData);
      } catch (e) {
        console.log('Error adding class to persistent storage:', e);
      }
      
      return newClass;
    } catch (error) {
      console.error('Error adding class to Firestore:', error);
      // Try fallback to localStorage
      const localClass = PersistentStorage.getInstance().addClass(classData);
      return localClass;
    }
  }

  async updateClass(id: string, classData: Partial<Class>): Promise<Class | undefined> {
    try {
      console.log("Starting class update process for:", id);
      
      // First, ensure we have the class in our cache
      let classToUpdate = this.classes.find(cls => cls.id === id);
      
      // If not in cache, try to fetch it first
      if (!classToUpdate) {
        console.log("Class not in cache, attempting to fetch it first:", id);
        classToUpdate = await this.getClassById(id);
        
        if (!classToUpdate) {
          console.error("Cannot update class that doesn't exist:", id);
          throw new Error(`Class with id ${id} not found`);
        }
      }
      
      // Now we have the class, proceed with update
      console.log("Updating class in storage:", id);
      
      // First try updating in Firestore
      try {
        const classRef = doc(db, 'classes', id);
        
        // Add updatedAt timestamp
        const updatedData = {
          ...classData,
          updatedAt: new Date().toISOString()
        };
        
        await updateDoc(classRef, updatedData);
        console.log("Class updated in Firestore successfully");
      } catch (firestoreError) {
        console.error("Error updating class in Firestore:", firestoreError);
      }
      
      // Update local cache
      const index = this.classes.findIndex(cls => cls.id === id);
      if (index !== -1) {
        this.classes[index] = { ...this.classes[index], ...classData };
        console.log("Class updated in local cache");
      } else {
        // This should not happen now that we prefetch the class if needed
        console.warn("Class not found in local cache after prefetch, adding it now:", id);
        if (classToUpdate) {
          this.classes.push({...classToUpdate, ...classData});
        }
      }
      
      // Also update in persistent storage
      const updatedClass = await PersistentStorage.getInstance().updateClass(id, classData);
      
      // Return the updated class - either from persistent storage or our cache
      if (updatedClass) {
        console.log("Class updated successfully in all storage layers:", id);
        return updatedClass;
      } else {
        console.warn("Class update in persistent storage failed, returning from cache");
        const cachedClass = this.classes.find(cls => cls.id === id);
        if (!cachedClass) {
          throw new Error("Class update returned no result");
        }
        return cachedClass;
      }
    } catch (error) {
      console.error("Error in overall updateClass process:", error);
      throw error; // Let the caller handle this error
    }
  }

  async deleteClass(id: string): Promise<boolean> {
    try {
      // Delete from Firestore
      const classRef = doc(db, 'classes', id);
      await deleteDoc(classRef);
      
      // Update local cache
      const initialLength = this.classes.length;
      this.classes = this.classes.filter(cls => cls.id !== id);
      
      // Also delete from persistent storage
      PersistentStorage.getInstance().deleteClass(id);
      
      console.log('Class deleted successfully:', id);
      return this.classes.length < initialLength;
    } catch (error) {
      console.error('Error deleting class from Firestore:', error);
      return PersistentStorage.getInstance().deleteClass(id);
    }
  }

  // Activity Logs - with safe wrapper to ensure array is ALWAYS returned
  async getActivityLogs(): Promise<ActivityLog[]> {
    try {
      // First create a safe fallback array
      const safeDefaultLogs = [
        {
          id: "log_safe_1",
          action: "System Started",
          details: "Safe initialization",
          timestamp: new Date().toISOString(),
          category: "System"
        }
      ];

      // Try Firestore
      try {
        console.log("Getting activity logs from Firestore...");
        const logsRef = collection(db, 'activityLogs');
        const snapshot = await getDocs(logsRef);
        
        if (snapshot && snapshot.docs && Array.isArray(snapshot.docs) && snapshot.docs.length > 0) {
          const logs = [];
          for (let i = 0; i < snapshot.docs.length; i++) {
            try {
              const doc = snapshot.docs[i];
              if (doc && typeof doc.data === 'function') {
                const data = doc.data();
                logs.push({
                  id: doc.id || `log_${Date.now()}_${i}`,
                  action: (data && data.action) ? data.action : 'Unknown Action',
                  details: (data && data.details) ? data.details : '',
                  timestamp: (data && data.timestamp) ? data.timestamp : new Date().toISOString(),
                  category: (data && data.category) ? data.category : 'General'
                });
              }
            } catch (docError) {
              console.error("Error processing a single document:", docError);
            }
          }
          
          if (logs.length > 0) {
            console.log(`Retrieved ${logs.length} activity logs from Firestore`);
            this.activityLogs = logs;
            return Object.freeze([...logs]); // Return an immutable copy
          }
        }
      } catch (firebaseError) {
        console.error("Error fetching activity logs from Firestore:", firebaseError);
      }
      
      // Try localStorage
      try {
        const localLogs = PersistentStorage.getInstance().getActivityLogs();
        if (localLogs && Array.isArray(localLogs) && localLogs.length > 0) {
          console.log('Using local storage activity logs:', localLogs);
          this.activityLogs = localLogs;
          return Object.freeze([...localLogs]); // Return an immutable copy
        }
      } catch (localError) {
        console.error("Error getting activity logs from local storage:", localError);
      }
      
      // When all else fails, return our safe array
      console.log('All log retrieval methods failed, using safe default logs');
      return Object.freeze([...safeDefaultLogs]);
  } catch (error) {
      console.error("Critical error in getActivityLogs:", error);
      return Object.freeze([{
        id: "log_error",
        action: "Error Recovery",
        details: "System recovered from critical error",
        timestamp: new Date().toISOString(),
        category: "Error"
      }]);
    }
  }

  // A completely safe wrapper function to ensure we ALWAYS get an array
  // Use this method in UI components
  async getSafeActivityLogs(): Promise<ActivityLog[]> {
    try {
      const logs = await this.getActivityLogs();
      
      // Ensure it's a valid array
      if (logs && Array.isArray(logs)) {
        return logs;
      } else {
        console.error("getActivityLogs returned non-array, using fallback");
        return Object.freeze([{
          id: "log_fallback_safe",
          action: "System Recovered",
          details: "Recovered from invalid data format",
          timestamp: new Date().toISOString(),
          category: "System Recovery"
        }]);
      }
    } catch (error) {
      console.error("Error in getSafeActivityLogs:", error);
      return Object.freeze([{
        id: "log_error_safe",
        action: "Error Recovery",
        details: "Safe method recovered from error",
        timestamp: new Date().toISOString(),
        category: "Error"
      }]);
    }
  }

  async addActivityLog(log: Omit<ActivityLog, "id">): Promise<ActivityLog> {
    try {
      if (!log || typeof log !== 'object') {
        throw new Error('Invalid activity log object');
      }
      
      console.log("Adding activity log to Firestore:", log);
      
      // Ensure we have minimal required properties
      const safeLog = {
        action: log.action || 'Unknown action',
        details: log.details || '',
        timestamp: log.timestamp || new Date().toISOString(),
        category: log.category || 'General',
        createdAt: new Date().toISOString()
      };
      
      // Add to Firestore
      const logsRef = collection(db, 'activityLogs');
      const docRef = await addDoc(logsRef, safeLog);
      
      const newLog = { id: docRef.id, ...safeLog };
      
      // Update local cache safely
      if (!Array.isArray(this.activityLogs)) {
        this.activityLogs = [];
      }
      this.activityLogs.push(newLog);
      
      // Also add to persistent storage as backup
      try {
        PersistentStorage.getInstance().addActivityLog(safeLog);
      } catch (e) {
        console.log('Error adding activity log to persistent storage:', e);
      }
      
      return newLog;
  } catch (error) {
      console.error('Error adding activity log to Firestore:', error);
      // Fallback to localStorage with error handling
      try {
        return PersistentStorage.getInstance().addActivityLog(log);
      } catch (e) {
        console.error('Critical error adding activity log:', e);
        // Create a fallback log with generated ID
        const fallbackLog = {
          id: `log_fallback_${Date.now()}`,
          action: log?.action || 'Unknown action',
          details: log?.details || 'Error creating log',
          timestamp: new Date().toISOString(),
          category: log?.category || 'Error'
        };
        return fallbackLog;
      }
    }
  }

  // Filter curriculum data to only include published content for students
  filterPublishedContent(curriculumData: any): any {
    console.log("🔍 filterPublishedContent called with:", {
      hasData: !!curriculumData,
      isObject: typeof curriculumData === "object" && curriculumData !== null,
      keys: curriculumData ? Object.keys(curriculumData) : [],
      hasContent: !!(curriculumData && "content" in curriculumData)
    });
    
    if (!curriculumData) {
      console.log("❌ No curriculum data provided for filtering");
      return null;
    }

    const hasContentWrapper = typeof curriculumData === "object" && curriculumData !== null && "content" in curriculumData;
    const baseContent = hasContentWrapper ? curriculumData.content : curriculumData;

    console.log("🔍 Base content structure:", {
      hasContentWrapper,
      hasBaseContent: !!baseContent,
      baseContentType: typeof baseContent,
      baseContentKeys: baseContent ? Object.keys(baseContent) : [],
      hasLessons: !!(baseContent && baseContent.lessons),
      lessonsIsArray: !!(baseContent && baseContent.lessons && Array.isArray(baseContent.lessons)),
      lessonsCount: baseContent?.lessons?.length || 0
    });

    if (!baseContent) {
      console.log("❌ No curriculum content found for filtering");
      return null;
    }

    let clonedContent: any;
    try {
      if (typeof structuredClone === "function") {
        clonedContent = structuredClone(baseContent);
      } else {
        clonedContent = JSON.parse(JSON.stringify(baseContent));
      }
    } catch (error) {
      console.error("Error cloning curriculum content for filtering:", error);
      return null;
    }

    const clonedData: any = hasContentWrapper
      ? { ...curriculumData, content: clonedContent }
      : { content: clonedContent };

    if (!hasContentWrapper) {
      if (curriculumData.classId) clonedData.classId = curriculumData.classId;
      if (curriculumData.lastUpdated) clonedData.lastUpdated = curriculumData.lastUpdated;
    }

    if (!clonedData.content) {
      console.log("Cloned curriculum has no content to filter");
      return null;
    }

    const filterLesson = (lesson: any) => {
      if (!lesson || typeof lesson !== "object") return null;

      if (lesson.isPublished === true) {
        return { ...lesson, isPublished: true };
      }

        const lessonCopy = { ...lesson };
        
        if (lessonCopy.contents && Array.isArray(lessonCopy.contents)) {
        lessonCopy.contents = lessonCopy.contents
          .filter((content) => {
            const isPublished = content?.isPublished === true;
            if (isPublished) {
              console.log(`Including published content: ${content.title || "Untitled content"}`);
            }
            return isPublished;
          })
          .map((content) => ({ ...content, isPublished: true }));
        }
        
        if (lessonCopy.assignments && Array.isArray(lessonCopy.assignments)) {
        lessonCopy.assignments = lessonCopy.assignments
          .filter((assignment) => {
            const isPublished = assignment?.isPublished === true;
            if (isPublished) {
              console.log(`Including published assignment: ${assignment.title || "Untitled assignment"}`);
            }
            return isPublished;
          })
          .map((assignment) => ({ ...assignment, isPublished: true }));
        }
        
        if (lessonCopy.quizzes && Array.isArray(lessonCopy.quizzes)) {
        lessonCopy.quizzes = lessonCopy.quizzes
          .filter((quiz) => {
            const isPublished = quiz?.isPublished === true;
            if (isPublished) {
              console.log(`Including published quiz: ${quiz.title || "Untitled quiz"}`);
            }
            return isPublished;
          })
          .map((quiz) => ({ ...quiz, isPublished: true }));
      }

      const hasContent =
        (lessonCopy.contents && lessonCopy.contents.length > 0) ||
        (lessonCopy.assignments && lessonCopy.assignments.length > 0) ||
        (lessonCopy.quizzes && lessonCopy.quizzes.length > 0);

      return hasContent ? lessonCopy : null;
    };

    const content = clonedData.content;

    if (Array.isArray(content)) {
      clonedData.content = content.map(filterLesson).filter((lesson) => !!lesson);
    } else if (content.lessons && Array.isArray(content.lessons)) {
      clonedData.content.lessons = content.lessons.map(filterLesson).filter((lesson) => !!lesson);
    } else if (content.lessonMap && typeof content.lessonMap === "object") {
      const filteredLessonMap: Record<string, any> = {};

      Object.entries(content.lessonMap).forEach(([lessonId, lessonData]) => {
        const filteredLesson = filterLesson(lessonData);
        if (filteredLesson) {
          filteredLessonMap[lessonId] = filteredLesson;
        }
      });

      clonedData.content.lessonMap = filteredLessonMap;
    } else {
      if (content.assignments && Array.isArray(content.assignments)) {
        clonedData.content.assignments = content.assignments
          .filter((assignment) => assignment?.isPublished === true)
          .map((assignment) => ({ ...assignment, isPublished: true }));
      }

      if (content.contents && Array.isArray(content.contents)) {
        clonedData.content.contents = content.contents
          .filter((item) => item?.isPublished === true)
          .map((item) => ({ ...item, isPublished: true }));
      }
    }

    const finalHasPublished = this.hasPublishedContent(clonedData.content);
    console.log("🔍 Filter result:", {
      hasPublishedContent: finalHasPublished,
      lessonsCount: clonedData.content?.lessons?.length || 0,
      contentType: typeof clonedData.content,
      contentKeys: clonedData.content ? Object.keys(clonedData.content) : []
    });

    if (!finalHasPublished) {
      console.log("❌ No published content found after filtering");
      return null;
    }

    console.log(`✅ After filtering: ${clonedData.content.lessons ? clonedData.content.lessons.length : 'Unknown'} lessons with published content`);
    return clonedData;
  }

  // Check if content has any published items
  private hasPublishedContent(content: any): boolean {
    if (!content) return false;
    
    // Check if content is an array of lessons
    if (Array.isArray(content)) {
      // Check if any lesson is published
      const hasPublishedLessons = content.some(lesson => lesson.isPublished === true);
      if (hasPublishedLessons) {
        console.log("Found published lessons");
        return true;
      }
      
      // Check for published content items within lessons
      const hasPublishedContent = content.some(lesson => {
        // Check published contents
        if (lesson.contents && Array.isArray(lesson.contents)) {
          if (lesson.contents.some(item => item && item.isPublished === true)) {
            console.log(`Found published contents in lesson ${lesson.title || 'Untitled'}`);
            return true;
          }
        }
        
        // Check published assignments
        if (lesson.assignments && Array.isArray(lesson.assignments)) {
          if (lesson.assignments.some(assignment => assignment && assignment.isPublished === true)) {
            console.log(`Found published assignments in lesson ${lesson.title || 'Untitled'}`);
            return true;
          }
        }
        
        // Check published quizzes
        if (lesson.quizzes && Array.isArray(lesson.quizzes)) {
          if (lesson.quizzes.some(quiz => quiz && quiz.isPublished === true)) {
            console.log(`Found published quizzes in lesson ${lesson.title || 'Untitled'}`);
            return true;
          }
        }
        
        return false;
      });
      
      if (hasPublishedContent) {
        return true;
      }
    }
    
    // Check if content has a lessons property that is an array
    if (content.lessons && Array.isArray(content.lessons)) {
      // Check if any lesson is published
      const hasPublishedLessons = content.lessons.some(lesson => lesson.isPublished === true);
      if (hasPublishedLessons) {
        console.log("Found published lessons");
        return true;
      }
      
      // Check for published content items within lessons
      const hasPublishedContent = content.lessons.some(lesson => {
        // Check published contents
        if (lesson.contents && Array.isArray(lesson.contents)) {
          if (lesson.contents.some(item => item && item.isPublished === true)) {
            console.log(`Found published contents in lesson ${lesson.title || 'Untitled'}`);
            return true;
          }
        }
        
        // Check published assignments
        if (lesson.assignments && Array.isArray(lesson.assignments)) {
          if (lesson.assignments.some(assignment => assignment && assignment.isPublished === true)) {
            console.log(`Found published assignments in lesson ${lesson.title || 'Untitled'}`);
            return true;
          }
        }
        
        // Check published quizzes
        if (lesson.quizzes && Array.isArray(lesson.quizzes)) {
          if (lesson.quizzes.some(quiz => quiz && quiz.isPublished === true)) {
            console.log(`Found published quizzes in lesson ${lesson.title || 'Untitled'}`);
            return true;
          }
        }
        
        return false;
      });
      
      if (hasPublishedContent) {
        return true;
      }
    }
    
    // Check if content has a dedicated published flag
    if (content.isPublished === true) {
      console.log("Content itself is marked as published");
      return true;
    }
    
    // Check if content has an assignments array with published items
    if (content.assignments && Array.isArray(content.assignments)) {
      const hasPublishedAssignments = content.assignments.some(assignment => assignment && assignment.isPublished === true);
      if (hasPublishedAssignments) {
        console.log("Found published assignments in top-level content");
        return true;
      }
    }
    
    console.log("No published content found");
    return false;
  }

  // Get curriculum data for a class
  // Internal helper to get the full canonical curriculum from the primary source
  private async getFullCurriculum(classId: string): Promise<Curriculum | null> {
    console.log(`Getting full canonical curriculum for class ${classId}`)
    let curriculum: Curriculum | null = null

    // Priority 1: Firestore curricula collection (canonical source)
    try {
      const db = getFirestore();
      if (db) {
        const curriculumRef = doc(db, 'curricula', classId);
        const curriculumSnap = await getDoc(curriculumRef);
        
        if (curriculumSnap.exists()) {
          const data = curriculumSnap.data();
          console.log(`Found canonical curriculum in Firestore curricula/${classId}`);
          
          // Normalize structure
          if (data.content) {
            curriculum = {
              classId,
              content: data.content,
              lastUpdated: data.lastUpdated || new Date().toISOString()
            };
            return curriculum;
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching from Firestore curricula collection: ${error}`);
    }

    // Priority 2: Firestore classes document (embedded curriculum)
    try {
      const db = getFirestore();
      if (db) {
        const classDocRef = doc(db, 'classes', classId);
        const classDocSnap = await getDoc(classDocRef);

        if (classDocSnap.exists()) {
          const classData = classDocSnap.data();
          
          if (classData.curriculum) {
            console.log(`Found curriculum in Firestore classes/${classId}`);
            curriculum = {
              classId,
              content: classData.curriculum,
              lastUpdated: classData.curriculumLastUpdated || new Date().toISOString()
            };
            return curriculum;
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching from Firestore classes document: ${error}`);
    }

    // Priority 3: Persistent Storage
    try {
      let persistentStorageInstance;
      try {
        if (PersistentStorage && typeof PersistentStorage.getInstance === 'function') {
          persistentStorageInstance = PersistentStorage.getInstance();
          persistentStorageInstance.ensureInitialized();
        } else {
          const persistentStorageModule = await import('./persistentStorage');
          if (persistentStorageModule.PersistentStorage && typeof persistentStorageModule.PersistentStorage.getInstance === 'function') {
            persistentStorageInstance = persistentStorageModule.PersistentStorage.getInstance();
            persistentStorageInstance.ensureInitialized();
          }
        }
      } catch (error) {
        console.error(`Error initializing PersistentStorage: ${error}`);
      }
      
      if (persistentStorageInstance && persistentStorageInstance.getCurriculumByClassId) {
        const storedCurriculum = await persistentStorageInstance.getCurriculumByClassId(classId);
        
        if (storedCurriculum) {
          console.log(`Found curriculum in persistent storage`);
          
          // Normalize structure
          const storedWrapper = storedCurriculum.content
            ? storedCurriculum
            : {
                classId,
                content: storedCurriculum,
                lastUpdated: storedCurriculum?.lastUpdated,
              };
          
          curriculum = {
            classId,
            content: storedWrapper.content,
            lastUpdated: storedWrapper.lastUpdated || new Date().toISOString()
          };
          return curriculum;
        }
      }
    } catch (error) {
      console.error(`Error fetching from persistent storage: ${error}`);
    }

    // Priority 4: localStorage
    if (typeof window !== 'undefined') {
      try {
        const localCurriculumStr = localStorage.getItem(`curriculum_${classId}`);
        
        if (localCurriculumStr) {
          const localCurriculum = JSON.parse(localCurriculumStr);
          console.log(`Found curriculum in localStorage`);
          
          // Normalize structure
          if (localCurriculum.content) {
            curriculum = {
              classId,
              content: localCurriculum.content,
              lastUpdated: localCurriculum.lastUpdated || new Date().toISOString()
            };
          } else {
            curriculum = {
              classId,
              content: localCurriculum,
              lastUpdated: localCurriculum.lastUpdated || new Date().toISOString()
            };
          }
          return curriculum;
        }
      } catch (error) {
        console.error(`Error fetching from localStorage: ${error}`);
      }
    }

    // Priority 5: Embedded in class data from memory
    try {
      const classes = await this.getClasses();
      const classData = classes.find(c => c.id === classId);
      
      if (classData && classData.curriculum) {
        console.log(`Found curriculum in embedded class data`);
        curriculum = {
          classId,
          content: classData.curriculum,
          lastUpdated: classData.curriculumLastUpdated || new Date().toISOString()
        };
        return curriculum;
      }
    } catch (error) {
      console.error(`Error fetching from embedded class data: ${error}`);
    }

    return null;
  }

  // Public method: Get curriculum with role-based filtering
  async getCurriculum(classId: string, userRole: 'student' | 'teacher' | 'admin' = 'teacher'): Promise<Curriculum | null> {
    console.log(`Getting curriculum for class ${classId} with userRole: ${userRole}`)
    
    // Get the full canonical curriculum
    const fullCurriculum = await this.getFullCurriculum(classId);
    
    if (!fullCurriculum || !fullCurriculum.content) {
      console.log(`No curriculum found for class ${classId}`);
      return null;
    }

    // Teachers and admins see the full curriculum
    if (userRole === 'teacher' || userRole === 'admin') {
      console.log(`Returning full curriculum for ${userRole}`);
      return fullCurriculum;
    }

    // Students: filter to only published content
    if (userRole === 'student') {
      console.log(`Filtering curriculum for student - only published content`);
      
      if (!fullCurriculum.content.lessons || !Array.isArray(fullCurriculum.content.lessons)) {
        console.log(`No lessons found in curriculum`);
        return null;
      }

      // Filter lessons to only include those with published content
      const filteredLessons = fullCurriculum.content.lessons
        .map((lesson: any) => {
          if (!lesson || !lesson.contents || !Array.isArray(lesson.contents)) {
            return null;
          }
          
      // Filter contents to only published items (strict check: isPublished must be exactly true)
      const publishedContents = lesson.contents.filter((c: any) => {
        // Strict check: isPublished must be exactly true (not truthy, not undefined)
        const isPublished = c?.isPublished === true;
        if (isPublished) {
          console.log(`✅ Including published content: "${c.title || c.id}" (isPublished: ${c.isPublished}, type: ${typeof c.isPublished})`);
        } else {
          console.log(`❌ Excluding content: "${c.title || c.id}" (isPublished: ${c.isPublished}, type: ${typeof c.isPublished})`);
        }
        return isPublished;
      });
      
      // Only include lesson if it has published content
      if (publishedContents.length === 0) {
        console.log(`Lesson "${lesson.title || lesson.id}" has no published content, excluding`);
        return null;
      }
      
      console.log(`Lesson "${lesson.title || lesson.id}" has ${publishedContents.length} published content items`);
      return {
        ...lesson,
        contents: publishedContents
      };
        })
        .filter((lesson: any) => lesson !== null); // Remove null lessons

      if (filteredLessons.length === 0) {
        console.log(`No published content found for student`);
        return null;
      }

      const filteredCurriculum: Curriculum = {
        ...fullCurriculum,
        content: {
          ...fullCurriculum.content,
          lessons: filteredLessons
        }
      };

      // Log summary of what student will see
      const totalPublishedContent = filteredLessons.reduce((sum: number, lesson: any) => 
        sum + (lesson.contents?.length || 0), 0
      );
      console.log(`✅ Returning filtered curriculum for student:`);
      console.log(`   - ${filteredLessons.length} lessons with published content`);
      console.log(`   - ${totalPublishedContent} total published content items`);
      filteredLessons.forEach((lesson: any) => {
        console.log(`   - Lesson "${lesson.title || lesson.id}": ${lesson.contents?.length || 0} published items`);
      });
      
      return filteredCurriculum;
    }

    return fullCurriculum;
  }

  // DEPRECATED: Legacy method removed - use getCurriculum with role parameter instead
  // This method is kept temporarily for reference but should not be called
  private async getCurriculum_OLD_DEPRECATED(classId: string, userRole?: 'student' | 'teacher' | 'admin'): Promise<Curriculum | null> {
    console.log(`Getting curriculum for class ${classId} with userRole: ${userRole}`)
    let curriculum: Curriculum | null = null

    // Attempt to fetch from Firestore
    try {
      const db = getFirestore();
      if (!db) {
        console.error("Firestore instance not available")
        throw new Error("Firestore instance not available")
      }

      // 1) For students, first try the dedicated published_curricula collection (DEPRECATED - kept for migration)
      if (userRole === 'student') {
        try {
          console.log(`Attempting to fetch PUBLISHED curriculum for class ${classId} from Firestore (published_curricula) - DEPRECATED`)

          // Try direct document lookup first (doc id == classId)
          const publishedDocRef = doc(db, 'published_curricula', classId)
          const publishedDocSnap = await getDoc(publishedDocRef)
          let publishedData = null

          if (publishedDocSnap.exists()) {
            publishedData = publishedDocSnap.data()
          } else {
            // Fallback to legacy query (older docs might not use classId as doc ID)
            const publishedRef = collection(db, 'published_curricula')
            const publishedQuery = query(publishedRef, where('classId', '==', classId))
            const publishedSnap = await getDocs(publishedQuery)

            if (publishedSnap && publishedSnap.docs && publishedSnap.docs.length > 0) {
              publishedData = publishedSnap.docs[0].data()
            }
          }

          if (publishedData) {
            console.log(`Found published_curricula document for class ${classId}, data structure:`, {
              hasContent: !!publishedData.content,
              hasLessons: !!(publishedData.content && publishedData.content.lessons),
              lessonsCount: publishedData.content?.lessons?.length || 0,
              rawKeys: Object.keys(publishedData)
            })
            
            // published_curricula already contains only published content, so we can use it directly
            // But we still need to ensure the structure is correct
            if (publishedData.content && publishedData.content.lessons) {
              console.log(`✅ Found published curriculum for class ${classId} in published_curricula (already filtered)`)
              curriculum = {
                classId,
                content: publishedData.content,
                lastUpdated: publishedData.lastUpdated || new Date().toISOString()
              }
              // If we successfully found published curriculum, we can skip other Firestore lookups
              console.log(`Returning curriculum with ${curriculum.content.lessons?.length || 0} lessons`)
              return curriculum
            } else {
              // Fallback: try filtering in case the structure is different
              const sanitizedPublished = this.filterPublishedContent(publishedData)
              if (sanitizedPublished && sanitizedPublished.content) {
                console.log(`✅ Found published curriculum for class ${classId} in published_curricula (after filtering)`)
                curriculum = {
                  classId,
                  content: sanitizedPublished.content,
                  lastUpdated: sanitizedPublished.lastUpdated || publishedData.lastUpdated || new Date().toISOString()
                }
                console.log(`Returning curriculum with ${curriculum.content.lessons?.length || 0} lessons`)
                return curriculum
              }
              console.log(`❌ Published curriculum record for class ${classId} contained no valid content structure`)
            }
          } else {
            console.log(`❌ No published curriculum record found for class ${classId}`)
          }
        } catch (publishedError) {
          console.error(`Error fetching published curriculum from Firestore: ${publishedError}`)
          // Fall through to other strategies
        }
      }

      // 2) Fall back to curriculum embedded in the class document
      console.log(`Attempting to fetch curriculum for class ${classId} from Firestore (classes document)`)
      const classDocRef = doc(db, 'classes', classId)
      const classDocSnap = await getDoc(classDocRef)

      if (classDocSnap.exists()) {
        const classData = classDocSnap.data()
        
        if (classData.curriculum) {
          console.log(`Found curriculum for class ${classId} in Firestore classes document`)
          
          if (userRole === 'student') {
            const sanitizedClassCurriculum = this.filterPublishedContent({
                classId,
                content: classData.curriculum,
              lastUpdated: classData.curriculumLastUpdated
            })

            if (sanitizedClassCurriculum && sanitizedClassCurriculum.content) {
              curriculum = {
                classId,
                content: sanitizedClassCurriculum.content,
                lastUpdated: sanitizedClassCurriculum.lastUpdated || classData.curriculumLastUpdated || new Date().toISOString()
              }
              console.log(`Returning filtered curriculum for student from classes document`)
            } else {
              console.log(`No published content found for student in classes document`)
            }
          } else {
            // For teachers and admins, return the full curriculum
            curriculum = {
              classId,
              content: classData.curriculum,
              lastUpdated: classData.curriculumLastUpdated || new Date().toISOString()
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching curriculum from Firestore: ${error}`)
      // Continue to next attempt
    }

    // If not in Firestore, try persistent storage
    if (!curriculum) {
      try {
        // Second attempt: Persistent Storage
        console.log(`Attempting to fetch curriculum for class ${classId} from persistent storage`)
        
        // Get persistent storage instance safely
        let persistentStorageInstance;
        try {
          // Use the already imported PersistentStorage from the top of the file
          if (PersistentStorage && typeof PersistentStorage.getInstance === 'function') {
            persistentStorageInstance = PersistentStorage.getInstance();
            persistentStorageInstance.ensureInitialized();
          } else {
            // Fallback: try dynamic import with named exports
            const persistentStorageModule = await import('./persistentStorage');
            if (persistentStorageModule.PersistentStorage && typeof persistentStorageModule.PersistentStorage.getInstance === 'function') {
              persistentStorageInstance = persistentStorageModule.PersistentStorage.getInstance();
              persistentStorageInstance.ensureInitialized();
            } else {
              throw new Error("PersistentStorage.getInstance is not available");
            }
          }
        } catch (error) {
          console.error(`Error initializing PersistentStorage: ${error}`);
          throw new Error("Failed to initialize persistent storage");
        }
        
        if (persistentStorageInstance && persistentStorageInstance.getCurriculumByClassId) {
          const storedCurriculum = await persistentStorageInstance.getCurriculumByClassId(classId);
          
          if (storedCurriculum) {
            console.log(`Found curriculum for class ${classId} in persistent storage`);
            
            // Normalize structure so we always have a content property
            const storedWrapper = storedCurriculum.content
              ? storedCurriculum
              : {
                  classId,
                  content: storedCurriculum,
                  lastUpdated: storedCurriculum?.lastUpdated,
                };
            
            if (userRole === 'student') {
              const sanitizedStored = this.filterPublishedContent(storedWrapper);
              if (sanitizedStored && sanitizedStored.content) {
                curriculum = {
                  classId,
                  content: sanitizedStored.content,
                  lastUpdated: sanitizedStored.lastUpdated || storedWrapper.lastUpdated || new Date().toISOString()
                };
                console.log(`Returning filtered curriculum for student from persistent storage`);
              } else {
                console.log(`No published content found for student in persistent storage`);
              }
            } else {
              curriculum = {
                classId,
                content: storedWrapper.content,
                lastUpdated: storedWrapper.lastUpdated || new Date().toISOString()
              };
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching curriculum from persistent storage: ${error}`);
        // Continue to next attempt
      }
    }

    // If not in persistent storage, try localStorage
    if (!curriculum && typeof window !== 'undefined') {
      try {
        // Third attempt: Local Storage
        console.log(`Attempting to fetch curriculum for class ${classId} from localStorage`);
        const localCurriculumStr = localStorage.getItem(`curriculum_${classId}`);
        
        if (localCurriculumStr) {
          const localCurriculum = JSON.parse(localCurriculumStr);
          console.log(`Found curriculum for class ${classId} in localStorage`);
          
          if (userRole === 'student') {
            const sanitizedLocal = this.filterPublishedContent(localCurriculum);
            if (sanitizedLocal && sanitizedLocal.content) {
              curriculum = {
                classId,
                content: sanitizedLocal.content,
                lastUpdated: sanitizedLocal.lastUpdated || localCurriculum.lastUpdated || new Date().toISOString()
              };
              console.log(`Returning filtered curriculum for student from localStorage`);
            } else {
              console.log(`No published content found for student in localStorage`);
            }
          } else {
            curriculum = localCurriculum;
          }
        }
      } catch (error) {
        console.error(`Error fetching curriculum from localStorage: ${error}`);
        // Continue to next attempt
      }
    }

    // If not in any storage, check embedded class data
    if (!curriculum) {
      try {
        // Fourth attempt: Embedded Class Data
        console.log(`Attempting to fetch curriculum for class ${classId} from embedded class data`);
        
        // Get auth safely
        let currentUser = null;
        try {
          const authInstance = getAuth();
          if (authInstance) {
            currentUser = authInstance.currentUser;
          }
        } catch (error) {
          console.error(`Error getting auth: ${error}`);
        }
        
        // Fallback to firebaseAuth if getAuth fails
        if (!currentUser && firebaseAuth) {
          currentUser = firebaseAuth.currentUser;
        }
        
        // Try to get classes from storage or alternative method
        let classes = [];
        try {
          // Try to get from storage
          classes = await this.getClasses();
        } catch (error) {
          console.error(`Error getting classes from storage: ${error}`);
          
          // Fallback to persistent storage
          try {
            if (PersistentStorage && typeof PersistentStorage.getInstance === 'function') {
              const persistentStorageInstance = PersistentStorage.getInstance();
              persistentStorageInstance.ensureInitialized();
              classes = persistentStorageInstance.getAllClasses();
            } else {
              console.error("PersistentStorage.getInstance is not available");
            }
          } catch (persistentError) {
            console.error(`Error getting classes from persistent storage: ${persistentError}`);
          }
        }
        
        const classData = classes.find(c => c.id === classId);
        
        if (classData && classData.curriculum) {
          console.log(`Found curriculum for class ${classId} in embedded class data`);
          
          if (userRole === 'student') {
            const sanitizedEmbedded = this.filterPublishedContent({
                classId,
                content: classData.curriculum,
              lastUpdated: classData.curriculumLastUpdated
            });

            if (sanitizedEmbedded && sanitizedEmbedded.content) {
              curriculum = {
                classId,
                content: sanitizedEmbedded.content,
                lastUpdated: sanitizedEmbedded.lastUpdated || classData.curriculumLastUpdated || new Date().toISOString()
              };
              console.log(`Returning filtered curriculum for student from embedded class data`);
            } else {
              console.log(`No published content found for student in embedded class data`);
            }
          } else {
            curriculum = {
              classId,
              content: classData.curriculum,
              lastUpdated: classData.curriculumLastUpdated || new Date().toISOString()
            };
          }
        }
      } catch (error) {
        console.error(`Error fetching curriculum from embedded class data: ${error}`);
      }
    }

    if (curriculum) {
      console.log(`✅ Successfully retrieved curriculum for class ${classId} with ${curriculum.content?.lessons?.length || 0} lessons`);
      return curriculum;
    } else {
      console.log(`❌ No curriculum found for class ${classId} after checking all sources`);
      return null;
    }
  }

  // Save curriculum for a class - saves to canonical location (curricula collection)
  async saveCurriculum(classId: string, curriculumData: {classId: string, content: any, lastUpdated: string}): Promise<boolean> {
    if (!classId || !curriculumData || !curriculumData.content) {
      console.error("Invalid curriculum data or class ID");
      return false;
    }
    
    let firestoreSuccess = false;
    let classUpdateSuccess = false;
    
    // Priority 1: Save to canonical Firestore curricula collection
    try {
      // Use the imported auth instance from firebase.ts
      const currentAuth = auth || getAuth();
      const currentUser = currentAuth?.currentUser;
      
      if (!currentUser) {
        console.error("❌ Cannot save curriculum: User not authenticated with Firebase Auth");
        console.error("Current auth state:", {
          authExists: !!auth,
          currentUser: currentUser?.uid || 'null',
          email: currentUser?.email || 'null'
        });
        // Don't return false here - continue to try other methods
      } else {
        console.log("✅ User authenticated:", {
          uid: currentUser.uid,
          email: currentUser.email
        });
        
        const dbInstance = db || getFirestore();
        const curriculumRef = doc(dbInstance, 'curricula', classId);
        
        console.log(`💾 Saving curriculum to Firestore: curricula/${classId}`);
        await setDoc(curriculumRef, {
          content: curriculumData.content,
          lastUpdated: new Date().toISOString(),
          classId: classId
        }, { merge: true });
        
        console.log("✅ Curriculum saved to canonical Firestore curricula collection");
        firestoreSuccess = true;
      }
    } catch (firestoreError: any) {
      console.error("❌ Error saving curriculum to Firestore:", firestoreError);
      console.error("Error details:", {
        code: firestoreError?.code,
        message: firestoreError?.message,
        stack: firestoreError?.stack
      });
      // Continue to save to other storage mechanisms
    }
    
    // Also update the class document for backwards compatibility
    try {
      const currentAuth = auth || getAuth();
      const currentUser = currentAuth?.currentUser;
      
      if (currentUser) {
        const dbInstance = db || getFirestore();
        const classRef = doc(dbInstance, 'classes', classId);
        
        console.log(`💾 Updating class document: classes/${classId}`);
        await updateDoc(classRef, {
          curriculum: curriculumData.content,
          curriculumLastUpdated: new Date().toISOString()
        });
        
        console.log("✅ Curriculum also saved to classes document for backwards compatibility");
        classUpdateSuccess = true;
      } else {
        console.warn("⚠️ Skipping class document update: User not authenticated");
      }
    } catch (classUpdateError: any) {
      console.error("❌ Error updating class document:", classUpdateError);
      console.error("Error details:", {
        code: classUpdateError?.code,
        message: classUpdateError?.message
      });
      // Non-critical, continue
    }
    
    // Save to persistent storage (cache only - not source of truth)
    try {
      const persistentStorage = PersistentStorage.getInstance();
      await persistentStorage.saveCurriculum(classId, curriculumData);
      console.log("Curriculum saved to persistent storage (cache)");
    } catch (persistentStorageError) {
      console.error("Error saving curriculum to persistent storage:", persistentStorageError);
      // Non-critical, continue
    }
    
    // Save to localStorage as a cache (not source of truth)
    if (typeof window !== 'undefined') {
    try {
      const localStorageKey = `curriculum_${classId}`;
      localStorage.setItem(localStorageKey, JSON.stringify(curriculumData));
        console.log("Curriculum saved to localStorage (cache)");
    } catch (localStorageError) {
      console.error("Error saving curriculum to localStorage:", localStorageError);
        // Non-critical, continue
      }
    }
    
    // Return true only if Firestore write succeeded (source of truth)
    // If Firestore failed, return false even if cache saves succeeded
    if (!firestoreSuccess) {
      console.error("❌ CRITICAL: Curriculum NOT saved to Firestore (source of truth). Cache saves succeeded but curriculum will not be visible to teachers/students.");
    }
    
    return firestoreSuccess || classUpdateSuccess; // Return true if at least one Firestore write succeeded
  }
  
  // Method for students to get published curriculum
  async getPublishedCurriculum(classId: string): Promise<any> {
    console.log(`Getting published curriculum for class ${classId}`);
    
    try {
      // First try to get from Firestore
      try {
        const curriculumRef = doc(db, 'curricula', classId);
        const curriculumSnapshot = await getDoc(curriculumRef);
        
        if (curriculumSnapshot.exists()) {
          const data = curriculumSnapshot.data();
          console.log(`Found curriculum in Firestore for class ${classId}`);
          
          // Filter for published content only
          return this.filterPublishedContent(data);
        }
      } catch (firestoreError) {
        console.error("Error getting curriculum from Firestore:", firestoreError);
      }
      
      // Then check localStorage for published version
      try {
        const publishedData = localStorage.getItem(`published-curriculum-${classId}`);
        if (publishedData) {
          return JSON.parse(publishedData);
        }
      } catch (localStorageError) {
        console.error("Error reading from localStorage:", localStorageError);
      }
      
      // Fall back to regular curriculum and filter it
      try {
        const regularCurriculum = localStorage.getItem(`curriculum_${classId}`);
        if (regularCurriculum) {
          const data = JSON.parse(regularCurriculum);
          return this.filterPublishedContent(data);
        }
      } catch (fallbackError) {
        console.error("Error with curriculum fallback:", fallbackError);
      }
      
      return null;
  } catch (error) {
      console.error("Error in getPublishedCurriculum:", error);
      return null;
    }
  }
  
  async updateCurriculum(classId: string, curriculum: Partial<Curriculum>): Promise<boolean> {
    try {
      console.log(`Updating curriculum for class ${classId} in Firestore`);
      
      // Verify the class exists before updating curriculum
      let classExists = false;
      try {
        // Check if class exists in Firestore
        const classRef = doc(db, 'classes', classId);
        const classSnapshot = await getDoc(classRef);
        classExists = classSnapshot.exists();
        
        if (!classExists) {
          // Check local cache as well
          classExists = this.classes.some(cls => cls.id === classId);
          
          // Last resort - check persistent storage
          if (!classExists) {
            const localClass = PersistentStorage.getInstance().getClassById(classId);
            classExists = !!localClass;
          }
        }
        
        if (!classExists) {
          console.error(`Cannot update curriculum - class ${classId} does not exist`);
          return false;
        }
      } catch (classCheckError) {
        console.warn(`Error checking if class ${classId} exists:`, classCheckError);
        // Continue anyway - we'll update the curriculum data
      }
      
      // First try to get existing curriculum
      let existingCurriculum = null;
      try {
        const curriculumRef = doc(db, 'curricula', classId);
        const curriculumSnapshot = await getDoc(curriculumRef);
        if (curriculumSnapshot.exists()) {
          existingCurriculum = curriculumSnapshot.data();
        }
      } catch (getError) {
        console.warn(`Could not retrieve existing curriculum for ${classId}:`, getError);
      }
      
      // Update curriculum in Firestore
      try {
        const curriculumRef = doc(db, 'curricula', classId);
        
        // Merge with existing data if available
        const updateData = existingCurriculum 
          ? { ...existingCurriculum, ...curriculum, updatedAt: new Date().toISOString() }
          : { ...curriculum, updatedAt: new Date().toISOString() };
        
        await setDoc(curriculumRef, updateData, { merge: true });
        
        // Also update in persistent storage as fallback
        try {
          await PersistentStorage.getInstance().updateCurriculum(classId, curriculum);
        } catch (storageError) {
          console.log('Error updating curriculum in persistent storage:', storageError);
        }
        
        // Create a direct key-value in localStorage as a last resort
        if (typeof window !== "undefined") {
          try {
            // First try to get existing localStorage data
            const existingLocalData = localStorage.getItem(`curriculum_${classId}`);
            let localData = curriculum;
            
            if (existingLocalData) {
              try {
                const parsedLocalData = JSON.parse(existingLocalData);
                localData = { ...parsedLocalData, ...curriculum };
              } catch (parseError) {
                console.warn('Could not parse existing localStorage curriculum data:', parseError);
              }
            }
            
            localStorage.setItem(`curriculum_${classId}`, JSON.stringify(localData));
          } catch (e) {
            console.log('Error saving curriculum to localStorage:', e);
          }
        }
        
        return true;
      } catch (updateError) {
        console.error(`Error updating curriculum in Firestore:`, updateError);
        throw updateError;
      }
  } catch (error) {
      console.error(`Error in overall curriculum update process:`, error);
      
      // Try persistent storage as fallback
      try {
        return await PersistentStorage.getInstance().updateCurriculum(classId, curriculum);
      } catch (persistentError) {
        console.error('Error updating in persistent storage too:', persistentError);
        
        // Last resort - direct localStorage
        if (typeof window !== "undefined") {
          try {
            // Get existing data if possible
            const existingData = localStorage.getItem(`curriculum_${classId}`);
            let mergedData = curriculum;
            
            if (existingData) {
              try {
                const parsedData = JSON.parse(existingData);
                mergedData = { ...parsedData, ...curriculum };
              } catch (e) {
                // Use curriculum as is if parsing fails
              }
            }
            
            localStorage.setItem(`curriculum_${classId}`, JSON.stringify(mergedData));
            return true;
          } catch (e) {
            console.error('All curriculum update methods failed:', e);
          }
        }
        return false;
      }
    }
  }

  // Enrollment
  async enrollStudent(classId: string, studentId: string): Promise<boolean> {
    console.log(`Enrolling student ${studentId} in class ${classId}`);
    
    if (!classId || !studentId) {
      console.error("Invalid class ID or student ID for enrollment");
      return false;
    }
    
    try {
      // First get the class to update
      const classToUpdate = await this.getClassById(classId);
      if (!classToUpdate) {
        console.error(`Class ${classId} not found for enrollment`);
        return false;
      }
      
      // Get the student to verify they exist
      const studentToEnroll = await this.getUserById(studentId);
      if (!studentToEnroll) {
        console.error(`Student ${studentId} not found for enrollment`);
        return false;
      }
      
      // Initialize enrolledStudents array if it doesn't exist
      if (!classToUpdate.enrolledStudents) {
        classToUpdate.enrolledStudents = [];
      } else if (!Array.isArray(classToUpdate.enrolledStudents)) {
        // Convert to array if it's not already
        classToUpdate.enrolledStudents = [];
      }
      
      // Check if student is already enrolled
      if (classToUpdate.enrolledStudents.includes(studentId)) {
        console.log(`Student ${studentId} is already enrolled in class ${classId}`);
        
        // Still make sure we have a direct enrollment record
        this.storeStudentEnrollment(studentId, classId);
        
        return true;
      }
      
      // Add student to enrolledStudents array
      classToUpdate.enrolledStudents.push(studentId);
      
      // Update the class
      await this.updateClass(classId, { 
        enrolledStudents: classToUpdate.enrolledStudents,
        updatedAt: new Date().toISOString()
      });
      
      // Update student's classes list
      if (!studentToEnroll.classes) {
        studentToEnroll.classes = [];
      }
      if (!studentToEnroll.classes.includes(classId)) {
        studentToEnroll.classes.push(classId);
        await this.updateUser(studentId, { 
          classes: studentToEnroll.classes 
        });
      }
      
      // Make sure we store a direct enrollment record
      this.storeStudentEnrollment(studentId, classId);
      
      // Update enrollment in persistent storage as well
      try {
        PersistentStorage.getInstance().enrollStudent(classId, studentId);
      } catch (persistentError) {
        console.error("Error enrolling in persistent storage:", persistentError);
      }
      
      console.log(`Successfully enrolled student ${studentId} in class ${classId}`);
      return true;
    } catch (error) {
      console.error("Error enrolling student:", error);
      return false;
    }
  }

  // Save a direct record of student enrollment for easier lookup
  private storeStudentEnrollment(studentId: string, classId: string): void {
    if (typeof window === 'undefined' || !studentId || !classId) return;
    
    try {
      // Store in a format that's easy to look up by student ID
      const enrollmentsKey = `student-enrollments-${studentId}`;
      
      // Get existing enrollments
      let enrollments: string[] = [];
      const existingData = localStorage.getItem(enrollmentsKey);
      
      if (existingData) {
        try {
          const parsed = JSON.parse(existingData);
          if (Array.isArray(parsed)) {
            enrollments = parsed;
          }
        } catch (e) {
          console.warn("Error parsing existing enrollments, creating new array");
        }
      }
      
      // Add this class if not already included
      if (!enrollments.includes(classId)) {
        enrollments.push(classId);
      }
      
      // Save updated enrollments
      localStorage.setItem(enrollmentsKey, JSON.stringify(enrollments));
      console.log(`Stored direct enrollment record for student ${studentId} with ${enrollments.length} classes`);
      
      // Also store in another format to lookup students by class
      const classStudentsKey = `class-students-${classId}`;
      let classStudents: string[] = [];
      const existingClassData = localStorage.getItem(classStudentsKey);
      
      if (existingClassData) {
        try {
          const parsed = JSON.parse(existingClassData);
          if (Array.isArray(parsed)) {
            classStudents = parsed;
          }
        } catch (e) {
          console.warn("Error parsing existing class students, creating new array");
        }
      }
      
      // Add this student if not already included
      if (!classStudents.includes(studentId)) {
        classStudents.push(studentId);
      }
      
      // Save updated class students
      localStorage.setItem(classStudentsKey, JSON.stringify(classStudents));
    } catch (error) {
      console.error("Error storing enrollment record:", error);
    }
  }

  // Files
  async uploadFile(file: File, path: string): Promise<UploadResult> {
    try {
      console.log(`Uploading file ${file.name} to path ${path}`);
      
    const storageRef = ref(firebaseStorage, path);
      const uploadTask = uploadBytes(storageRef, file);
      
      await uploadTask;
      
      const downloadURL = await getDownloadURL(storageRef);
      
      console.log(`File ${file.name} uploaded successfully to ${path}`);
      return { url: downloadURL, path };
  } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error);
    throw error;
  }
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      console.log(`Deleting file at path ${path}`);
      
      const storageRef = ref(firebaseStorage, path);
      await deleteObject(storageRef);
      
      console.log(`File at path ${path} deleted successfully`);
      return true;
    } catch (error) {
      console.error(`Error deleting file at path ${path}:`, error);
      return false;
    }
  }

  // Get classes by student ID - directly from all available sources
  async getClassesByStudentId(studentId: string): Promise<Class[]> {
    console.log(`Storage: Getting classes for student ID ${studentId}`);
    
    if (!studentId) {
      console.warn("Storage: Invalid student ID provided");
      return [];
    }
    
    // Try multiple sources to find the student's enrolled classes
    let enrolledClasses: Class[] = [];
    
    // 1. First check our cached classes
    if (this.classes && Array.isArray(this.classes) && this.classes.length > 0) {
      const cachedEnrolledClasses = this.classes.filter(cls => 
        cls.enrolledStudents && 
        Array.isArray(cls.enrolledStudents) && 
        cls.enrolledStudents.includes(studentId)
      );
      
      if (cachedEnrolledClasses.length > 0) {
        console.log(`Storage: Found ${cachedEnrolledClasses.length} classes in cache for student ${studentId}`);
        enrolledClasses = [...cachedEnrolledClasses];
      }
    }
    
    // 2. Try to get from Firestore
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        console.log("Storage: Attempting to fetch classes from Firestore...");
        const db = getFirestore();
        const classesRef = collection(db, 'classes');
        // Query for classes where this student is enrolled
        const q = query(classesRef, where('enrolledStudents', 'array-contains', studentId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const firestoreClasses = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Class));
          
          console.log(`Storage: Found ${firestoreClasses.length} classes in Firestore for student ${studentId}`);
          
          // Merge with existing classes, avoiding duplicates
          firestoreClasses.forEach(cls => {
            if (!enrolledClasses.some(existingCls => existingCls.id === cls.id)) {
              enrolledClasses.push(cls);
            }
          });
        } else {
          console.log("Storage: No classes found in Firestore for student", studentId);
        }
      } else {
        console.log("Storage: No authenticated user found, skipping Firestore query");
      }
    } catch (firestoreError) {
      console.error("Storage: Error getting classes from Firestore:", firestoreError);
      // Don't throw the error, just log it and continue with local storage
    }
    
    // 3. Check localStorage directly
    if (typeof window !== "undefined") {
      try {
        // First check for a direct enrollment record
        const enrollmentsKey = `student-enrollments-${studentId}`;
        const enrollmentsJson = localStorage.getItem(enrollmentsKey);
        
        if (enrollmentsJson) {
          const enrollmentData = JSON.parse(enrollmentsJson);
          if (Array.isArray(enrollmentData) && enrollmentData.length > 0) {
            console.log(`Storage: Found direct enrollment data in localStorage for student ${studentId}`);
            
            // Look up each class by ID
            for (const classId of enrollmentData) {
              // Skip if we already have this class
              if (enrolledClasses.some(cls => cls.id === classId)) continue;
              
              // Try to get the class details
              const classData = await this.getClassById(classId);
              if (classData) {
                enrolledClasses.push(classData);
              }
            }
          }
        }
        
        // If still no classes, try to parse all classes from localStorage
        if (enrolledClasses.length === 0) {
          const allClassesJson = localStorage.getItem('classes');
          if (allClassesJson) {
            try {
              const allClasses = JSON.parse(allClassesJson);
              if (Array.isArray(allClasses)) {
                const filtered = allClasses.filter(cls => 
                  cls && cls.enrolledStudents && 
                  Array.isArray(cls.enrolledStudents) && 
                  cls.enrolledStudents.includes(studentId)
                );
                
                if (filtered.length > 0) {
                  console.log(`Storage: Found ${filtered.length} classes in localStorage for student ${studentId}`);
                  filtered.forEach(cls => {
                    if (!enrolledClasses.some(existingCls => existingCls.id === cls.id)) {
                      enrolledClasses.push(cls);
                    }
                  });
                }
              }
            } catch (parseError) {
              console.error("Storage: Error parsing classes from localStorage:", parseError);
            }
          }
        }
      } catch (localStorageError) {
        console.error("Storage: Error accessing localStorage:", localStorageError);
      }
    }
    
    console.log(`Storage: Returning ${enrolledClasses.length} total enrolled classes for student ${studentId}`);
    // Update our cache with any new classes we found
    enrolledClasses.forEach(cls => {
      const existingIndex = this.classes.findIndex(c => c.id === cls.id);
      if (existingIndex >= 0) {
        this.classes[existingIndex] = cls;
      } else {
        this.classes.push(cls);
      }
    });
    
    return enrolledClasses;
  }
}

// Export a singleton instance
export const storage = new StorageService();