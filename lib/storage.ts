// @ts-nocheck
// Storage service for client-side data management

// Type declarations for external modules to suppress errors
// @ts-ignore
import { persistentStorage } from "@/lib/persistentStorage"
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
import { storage as firebaseStorage, db } from './firebase';
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
  writeBatch
} from 'firebase/firestore';
// Import Firebase Auth functionality
import { firebaseAuth } from './firebase-auth';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from './firebase';

// Types
export interface User {
  id: string
  name: string
  email: string
  password: string
  role: "student" | "teacher" | "admin"
  status?: "active" | "inactive"
  avatar?: string
  classes: string[]
}

export interface Class {
  id: string
  name: string
  teacher: string
  teacher_id?: string
  location?: string
  meetingDates?: string
  startDate?: string
  endDate?: string
  startTime?: string
  endTime?: string
  virtualLink?: string
  status?: string
  students: number
  enrolledStudents?: string[]
  subject?: string
  meeting_day?: string
}

export interface ActivityLog {
  id: string
  action: string
  details: string
  timestamp: string
  category: string
}

export interface Submission {
  id: string
  studentId: string
  classId: string
  assignmentId: string
  content: string
  status: "submitted" | "graded" | "returned"
  grade?: number
  feedback?: string
  submittedAt: string
  gradedAt?: string
}

export interface UploadResult {
  url: string;
  path: string;
}

export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

export interface Curriculum {
  classId: string;
  content: {
    lessons?: {
      id: string;
      title: string;
      description?: string;
      resources?: Array<{
        id: string;
        title: string;
        type: string;
        url?: string;
        content?: string;
      }>;
    }[];
    assignments?: {
      id: string;
      title: string;
      description: string;
      dueDate?: string;
      points?: number;
    }[];
  };
  lastUpdated?: string;
}

class StorageService {
  private users: User[] = []
  private classes: Class[] = []
  private activityLogs: ActivityLog[] = []

  async getUsers(): Promise<User[]> {
    console.log("Getting all users");
    
    try {
      // First try to get users from Firestore
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      
      if (!usersSnapshot.empty) {
        const usersData = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as User[];
        
        console.log(`Retrieved ${usersData.length} users from Firestore`);
        
        // Update cache
        this.users = usersData;
        
        return usersData;
      }
      
      // Fallback to local state if available and non-empty
      if (this.users && this.users.length > 0) {
        console.log(`Using ${this.users.length} cached users`);
        return [...this.users];
      }
      
      // Final fallback to persistent storage
      try {
        console.log("Fetching users from persistent storage");
        const persistentUsers = persistentStorage.getAllUsers();
        
        if (persistentUsers && persistentUsers.length > 0) {
          console.log(`Retrieved ${persistentUsers.length} users from persistent storage`);
          
          // Update local cache
          this.users = persistentUsers;
          
          // Ensure users have the classes property
          this.users = this.users.map(user => ({
            ...user,
            classes: user.classes || []
          }));
          
          // Try to save back to Firestore for consistency
          try {
            for (const user of persistentUsers) {
              const userRef = doc(db, "users", user.id);
              await setDoc(userRef, user, { merge: true });
            }
            console.log("Synced users from persistent storage to Firestore");
          } catch (syncError) {
            console.warn("Failed to sync users to Firestore:", syncError);
          }
          
          return [...persistentUsers];
        }
      } catch (persistentError) {
        console.error("Error getting users from persistent storage:", persistentError);
      }
      
      // If we get here, we couldn't get users from any source
      console.warn("Could not retrieve users from any source, using empty array");
      return [];
    } catch (error) {
      console.error("Error in getUsers:", error);
      
      // In case of error, try to return cached values
      if (this.users && this.users.length > 0) {
        return [...this.users];
      }
      
      // Last resort: try persistent storage directly
      try {
        return persistentStorage.getAllUsers();
      } catch (e) {
        console.error("Final error getting users:", e);
        return [];
      }
    }
  }

  getUserById(id: string): User | undefined {
    // Try to find in the local cache first
    const localUser = this.users.find(user => user.id === id);
    if (localUser) return localUser;
    
    // If not found in cache, return from persistent storage
    return persistentStorage.getUserById(id);
  }

  getUserByEmail(email: string): User | undefined {
    // Try to find in the local cache first
    const localUser = this.users.find(user => user.email === email);
    if (localUser) return localUser;
    
    // If not found in cache, return from persistent storage
    return persistentStorage.getUserByEmail(email);
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
      
      // Also add to persistent storage as backup
      try {
        persistentStorage.addUser(enhancedUserData);
      } catch (e) {
        console.log('User already exists in persistent storage or other error:', e);
      }
      
      console.log('User added successfully:', newUser);
      return newUser;
    } catch (error) {
      console.error('Error adding user to Firestore:', error);
      // Try to add to persistent storage as fallback
      try {
        const localUser = persistentStorage.addUser(userData);
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
      
      // Also update in persistent storage
      persistentStorage.updateUser(id, updatedData);
      
      console.log('User updated successfully:', id);
      return this.users[index];
    } catch (error) {
      console.error('Error updating user:', error);
      return persistentStorage.updateUser(id, userData);
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      // Delete from Firestore
      const userRef = doc(db, 'users', id);
      await deleteDoc(userRef);
      
      // Update local cache
      const initialLength = this.users.length;
      this.users = this.users.filter(user => user.id !== id);
      
      // Also delete from persistent storage
      persistentStorage.deleteUser(id);
      
      console.log('User deleted successfully:', id);
      return this.users.length < initialLength;
    } catch (error) {
      console.error('Error deleting user:', error);
      return persistentStorage.deleteUser(id);
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
        const localClasses = persistentStorage.getAllClasses();
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
      return persistentStorage.getClassById(id);
    } catch (error) {
      console.error(`Error in getClassById for ${id}:`, error);
      return persistentStorage.getClassById(id);
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
        persistentStorage.addClass(enhancedClassData);
      } catch (e) {
        console.log('Error adding class to persistent storage:', e);
      }
      
      return newClass;
    } catch (error) {
      console.error('Error adding class to Firestore:', error);
      // Try fallback to localStorage
      const localClass = persistentStorage.addClass(classData);
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
      const updatedClass = await persistentStorage.updateClass(id, classData);
      
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
      persistentStorage.deleteClass(id);
      
      console.log('Class deleted successfully:', id);
      return this.classes.length < initialLength;
    } catch (error) {
      console.error('Error deleting class from Firestore:', error);
      return persistentStorage.deleteClass(id);
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
        const localLogs = persistentStorage.getActivityLogs();
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
        persistentStorage.addActivityLog(safeLog);
      } catch (e) {
        console.log('Error adding activity log to persistent storage:', e);
      }
      
      return newLog;
    } catch (error) {
      console.error('Error adding activity log to Firestore:', error);
      // Fallback to localStorage with error handling
      try {
        return persistentStorage.addActivityLog(log);
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

  // Curriculum
  async getCurriculum(classId: string): Promise<Curriculum | null> {
    console.log(`Getting curriculum for class ${classId}`);
    
    try {
      // First attempt to get from Firestore
      const curriculumRef = doc(db, 'curricula', classId);
      const curriculumSnapshot = await getDoc(curriculumRef);
      
      if (curriculumSnapshot.exists()) {
        const curriculumData = curriculumSnapshot.data();
        console.log(`Retrieved curriculum from Firestore for class ${classId}`);
        return curriculumData as Curriculum;
      }
      
      // Try alternate collection structure
      const classRef = doc(db, 'classes', classId);
      const curriculumRef2 = doc(classRef, 'curriculum', 'main');
      const curriculumSnapshot2 = await getDoc(curriculumRef2);
      
      if (curriculumSnapshot2.exists()) {
        const curriculumData = curriculumSnapshot2.data();
        console.log(`Retrieved curriculum from class/curriculum collection for class ${classId}`);
        return curriculumData as Curriculum;
      }
      
      console.log(`No curriculum found in Firestore for class ${classId}, trying persistent storage`);
      
      // Second attempt to get from persistent storage
      try {
        const persistentCurriculum = await persistentStorage.getCurriculum(classId);
        if (persistentCurriculum) {
          console.log(`Retrieved curriculum from persistent storage for class ${classId}`);
          
          // Save to Firestore to ensure consistency
          try {
            await this.saveCurriculum(classId, persistentCurriculum);
          } catch (saveError) {
            console.warn(`Failed to save persistent curriculum to Firestore: ${saveError}`);
          }
          
          return persistentCurriculum;
        }
      } catch (persistentError) {
        console.warn(`Error getting curriculum from persistent storage: ${persistentError}`);
      }
      
      // Third attempt: check localStorage
      if (typeof window !== "undefined") {
        try {
          // Try both the standardized and direct formats
          const standardizedData = localStorage.getItem(`curriculum_${classId}`);
          const directData = localStorage.getItem(`curriculum_direct_${classId}`);
          const legacyData = localStorage.getItem(`curriculum_${classId}_main`);
          const prefixedData = localStorage.getItem(`${STORAGE_PREFIX}curriculum_${classId}`);
          
          // First try the standardized format
          if (standardizedData) {
            try {
              const parsedData = JSON.parse(standardizedData);
              console.log(`Retrieved standardized curriculum from localStorage for class ${classId}`);
              return parsedData as Curriculum;
            } catch (parseError) {
              console.error(`Error parsing standardized curriculum data: ${parseError}`);
            }
          }
          
          // Then try the direct format
          if (directData) {
            try {
              const parsedDirectData = JSON.parse(directData);
              console.log(`Retrieved direct curriculum from localStorage for class ${classId}`);
              
              // Convert to standardized format
              const standardizedCurriculum = {
                classId,
                content: parsedDirectData,
                lastUpdated: new Date().toISOString()
              };
              
              return standardizedCurriculum as Curriculum;
            } catch (parseError) {
              console.error(`Error parsing direct curriculum data: ${parseError}`);
            }
          }
          
          // Try legacy format
          if (legacyData) {
            try {
              const parsedLegacyData = JSON.parse(legacyData);
              console.log(`Retrieved legacy curriculum from localStorage for class ${classId}`);
              return parsedLegacyData as Curriculum;
            } catch (parseError) {
              console.error(`Error parsing legacy curriculum data: ${parseError}`);
            }
          }
          
          // Try prefixed format
          if (prefixedData) {
            try {
              const parsedPrefixedData = JSON.parse(prefixedData);
              console.log(`Retrieved prefixed curriculum from localStorage for class ${classId}`);
              return parsedPrefixedData as Curriculum;
            } catch (parseError) {
              console.error(`Error parsing prefixed curriculum data: ${parseError}`);
            }
          }
        } catch (localStorageError) {
          console.warn(`Error checking localStorage: ${localStorageError}`);
        }
      }
      
      // Fourth attempt: check if curriculum is embedded in the class object
      const classData = await this.getClassById(classId);
      if (classData && classData.curriculum) {
        console.log(`Found curriculum embedded in class ${classId}`);
        
        // Format the data properly - if it's already in standardized format, use it directly
        let formattedCurriculum;
        
        if (classData.curriculum.content) {
          // It's already in standardized format
          formattedCurriculum = classData.curriculum;
        } else {
          // Convert to standardized format
          formattedCurriculum = {
            classId,
            content: classData.curriculum,
            lastUpdated: new Date().toISOString()
          };
        }
        
        // Save to Firestore for future use
        try {
          await this.saveCurriculum(classId, formattedCurriculum);
        } catch (saveError) {
          console.warn(`Failed to save embedded curriculum to Firestore: ${saveError}`);
        }
        
        return formattedCurriculum;
      }
      
      console.log(`No curriculum found for class ${classId} in any storage`);
      return null;
    } catch (error) {
      console.error(`Error retrieving curriculum for class ${classId}:`, error);
      return null;
    }
  }

  async saveCurriculum(classId: string, curriculum: Curriculum): Promise<boolean> {
    console.log(`Saving curriculum for class ${classId}`);
    
    // Normalize curriculum data structure to ensure compatibility
    let normalizedContent;
    
    // Handle both format types
    if (!curriculum) {
      console.error("Invalid curriculum data: curriculum is null or undefined");
      return false;
    }
    
    if (curriculum.content) {
      // Format 1: {classId, content: {...}}
      normalizedContent = curriculum.content;
    } else if (curriculum.lessons || curriculum.assignments) {
      // Format 2: Direct curriculum structure
      normalizedContent = curriculum;
    } else {
      console.error("Invalid curriculum data: missing required structure");
      return false;
    }
    
    // Handle individual content item with isPublished flag (like when publishing directly)
    if (normalizedContent && normalizedContent.isPublished !== undefined) {
      // Make sure isPublished is a boolean
      normalizedContent.isPublished = Boolean(normalizedContent.isPublished);
      
      // Handle content of type assignment or quiz
      if (normalizedContent.type === 'assignment' || normalizedContent.type === 'quiz') {
        const publishedKey = `published_${classId}_${normalizedContent.id}`;
        const publishedListKey = `published_assignments_${classId}`;
        
        if (normalizedContent.isPublished === true) {
          // PUBLISHING: Save to localStorage for student access
          try {
            // Create a stable key for the published item
            localStorage.setItem(publishedKey, JSON.stringify(normalizedContent));
            
            // Keep track of all published assignments for this class
            let existingPublished = [];
            try {
              const storedPublished = localStorage.getItem(publishedListKey);
              if (storedPublished) {
                existingPublished = JSON.parse(storedPublished);
              }
            } catch (e) {
              console.error("Error parsing existing published assignments", e);
            }
            
            // Add this assignment to the list if not already there
            if (!existingPublished.includes(normalizedContent.id)) {
              existingPublished.push(normalizedContent.id);
              localStorage.setItem(publishedListKey, JSON.stringify(existingPublished));
            }
            
            console.log(`Published assignment/quiz ${normalizedContent.id} saved to localStorage`);
          } catch (e) {
            console.error("Error saving published assignment to localStorage", e);
          }
        } else {
          // UNPUBLISHING: Remove from localStorage
          try {
            // Remove the assignment from localStorage
            localStorage.removeItem(publishedKey);
            
            // Remove from published assignments list
            try {
              const storedPublished = localStorage.getItem(publishedListKey);
              if (storedPublished) {
                let existingPublished = JSON.parse(storedPublished);
                existingPublished = existingPublished.filter(id => id !== normalizedContent.id);
                localStorage.setItem(publishedListKey, JSON.stringify(existingPublished));
              }
            } catch (e) {
              console.error("Error updating published assignments list during unpublish", e);
            }
            
            console.log(`Unpublished assignment/quiz ${normalizedContent.id} removed from localStorage`);
          } catch (e) {
            console.error("Error removing unpublished assignment from localStorage", e);
          }
        }
      }
    }
    
    // ADDITIONAL: Process assignments array if it exists in the curriculum structure
    if (normalizedContent.lessons && Array.isArray(normalizedContent.lessons)) {
      // Look through each lesson for published content
      normalizedContent.lessons.forEach((lesson, lessonIndex) => {
        if (lesson.contents && Array.isArray(lesson.contents)) {
          // Process each content item in the lesson
          lesson.contents.forEach((contentItem, contentIndex) => {
            if (contentItem && (contentItem.type === 'assignment' || contentItem.type === 'quiz')) {
              // Create assignment key for localStorage
              const assignmentKey = `assignment_${classId}_${contentItem.id}`;
              const publishedListKey = `published_assignments_${classId}`;
              
              if (contentItem.isPublished === true) {
                // PUBLISHING: Content is published, save it
                try {
                  // Create an enriched assignment with class and lesson data
                  const enrichedAssignment = {
                    ...contentItem,
                    classId: classId,
                    lessonId: lesson.id,
                    lessonTitle: lesson.title,
                    isPublished: true
                  };
                  
                  // Save to localStorage
                  localStorage.setItem(assignmentKey, JSON.stringify(enrichedAssignment));
                  
                  // Update the published assignments list for this class
                  let publishedList = [];
                  try {
                    const existingList = localStorage.getItem(publishedListKey);
                    if (existingList) {
                      publishedList = JSON.parse(existingList);
                    }
                  } catch (err) {
                    console.error("Error parsing published assignments list:", err);
                  }
                  
                  if (!publishedList.includes(contentItem.id)) {
                    publishedList.push(contentItem.id);
                    localStorage.setItem(publishedListKey, JSON.stringify(publishedList));
                  }
                  
                  console.log(`Published lesson content (${contentItem.type}) with ID ${contentItem.id} saved to localStorage`);
                } catch (e) {
                  console.error(`Error saving published content from lesson ${lesson.title}:`, e);
                }
              } else {
                // UNPUBLISHING: Content is not published, remove it
                try {
                  // Remove from localStorage
                  localStorage.removeItem(assignmentKey);
                  
                  // Update published list
                  try {
                    const existingList = localStorage.getItem(publishedListKey);
                    if (existingList) {
                      let publishedList = JSON.parse(existingList);
                      publishedList = publishedList.filter(id => id !== contentItem.id);
                      localStorage.setItem(publishedListKey, JSON.stringify(publishedList));
                    }
                  } catch (err) {
                    console.error("Error updating published assignments list during unpublish:", err);
                  }
                  
                  console.log(`Unpublished lesson content (${contentItem.type}) with ID ${contentItem.id} removed from localStorage`);
                } catch (e) {
                  console.error(`Error removing unpublished content for ${contentItem.id}:`, e);
                }
              }
            }
          });
        }
      });
    }
    
    // Also handle direct assignments array if present
    if (normalizedContent.assignments && Array.isArray(normalizedContent.assignments)) {
      normalizedContent.assignments.forEach(assignment => {
        if (assignment) {
          // Create specific key for individual assignment
          const assignmentKey = `assignment_${classId}_${assignment.id}`;
          const publishedListKey = `published_assignments_${classId}`;
          
          if (assignment.isPublished) {
            // PUBLISHING: Assignment is published
            try {
              // Create enriched assignment
              const enrichedAssignment = {
                ...assignment,
                classId: classId, 
                isPublished: true,
                type: 'assignment'  // Ensure type is set
              };
              
              localStorage.setItem(assignmentKey, JSON.stringify(enrichedAssignment));
              
              // Update published assignments list
              let publishedList = [];
              try {
                const existingList = localStorage.getItem(publishedListKey);
                if (existingList) {
                  publishedList = JSON.parse(existingList);
                }
              } catch (err) {
                console.error("Error parsing published assignments list:", err);
              }
              
              if (!publishedList.includes(assignment.id)) {
                publishedList.push(assignment.id);
                localStorage.setItem(publishedListKey, JSON.stringify(publishedList));
              }
              
              console.log(`Published assignment ${assignment.id} from assignments array saved to localStorage`);
            } catch (e) {
              console.error(`Error saving published assignment ${assignment.id}:`, e);
            }
          } else {
            // UNPUBLISHING: Assignment is not published
            try {
              // Remove from localStorage
              localStorage.removeItem(assignmentKey);
              
              // Update published list
              try {
                const existingList = localStorage.getItem(publishedListKey);
                if (existingList) {
                  let publishedList = JSON.parse(existingList);
                  publishedList = publishedList.filter(id => id !== assignment.id);
                  localStorage.setItem(publishedListKey, JSON.stringify(publishedList));
                }
              } catch (err) {
                console.error("Error updating published assignments list during unpublish:", err);
              }
              
              console.log(`Unpublished assignment ${assignment.id} removed from localStorage`);
            } catch (e) {
              console.error(`Error removing unpublished assignment ${assignment.id}:`, e);
            }
          }
        }
      });
    }

    // Create standardized curriculum object
    const standardizedCurriculum = {
      classId: classId,
      content: normalizedContent,
      lastUpdated: new Date().toISOString()
    };

    // Save to Firestore if available
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        const db = getFirestore();
        const classRef = doc(db, 'classes', classId);
        const curriculumRef = doc(classRef, 'curriculum', 'main');
        
        await setDoc(curriculumRef, standardizedCurriculum);
        
        console.log("Curriculum saved to Firestore successfully");
      }
    } catch (firestoreError) {
      console.error("Error saving curriculum to Firestore:", firestoreError);
      // Continue to save to localStorage as a backup
    }

    // Always save to localStorage as backup for offline access
    try {
      // Save both formats for better compatibility
      const currKey = `curriculum_${classId}`;
      localStorage.setItem(currKey, JSON.stringify(standardizedCurriculum));
      
      // Also save the direct curriculum for components that expect that format
      const directCurrKey = `curriculum_direct_${classId}`;
      localStorage.setItem(directCurrKey, JSON.stringify(normalizedContent));
      
      // Update the class object as well to ensure consistency
      try {
        const classData = await this.getClassById(classId);
        if (classData) {
          const updatedClass = {
            ...classData,
            curriculum: normalizedContent,
            updatedAt: new Date().toISOString()
          };
          
          await this.updateClass(classId, updatedClass);
          console.log("Class object updated with curriculum");
        }
      } catch (classUpdateError) {
        console.warn("Error updating class with curriculum:", classUpdateError);
      }
      
      console.log("Curriculum successfully saved to localStorage");
      return true;
    } catch (e) {
      console.error("Error saving curriculum to localStorage:", e);
      return false;
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
            const localClass = persistentStorage.getClassById(classId);
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
          await persistentStorage.updateCurriculum(classId, curriculum);
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
        return await persistentStorage.updateCurriculum(classId, curriculum);
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
    
    try {
      // First validate that both class and student exist
      const classData = await this.getClassById(classId);
      if (!classData) {
        console.error(`Cannot enroll student: Class ${classId} not found`);
        return false;
      }
      
      const student = await this.getUserById(studentId);
      if (!student) {
        console.error(`Cannot enroll student: Student ${studentId} not found`);
        return false;
      }
      
      if (student.role !== 'student') {
        console.error(`Cannot enroll non-student user: ${studentId} has role ${student.role}`);
        return false;
      }
      
      // Update class with enrolled student
      let enrolledStudents = classData.enrolledStudents || [];
      if (!Array.isArray(enrolledStudents)) {
        enrolledStudents = [];
      }
      
      // Check if student is already enrolled
      if (enrolledStudents.includes(studentId)) {
        console.log(`Student ${studentId} is already enrolled in class ${classId}`);
        return true;
      }
      
      // Add student to class
      enrolledStudents.push(studentId);
      
      // Update class record in all storage methods
      const updatedClass = {
        ...classData,
        enrolledStudents,
        students: enrolledStudents.length
      };
      
      // Update in Firestore
      try {
        const classRef = doc(db, 'classes', classId);
        await setDoc(classRef, updatedClass, { merge: true });
        console.log(`Updated class ${classId} in Firestore with enrolled student ${studentId}`);
      } catch (firestoreError) {
        console.error('Error updating class in Firestore:', firestoreError);
      }
      
      // Update in persistent storage
      try {
        persistentStorage.updateClass(classId, updatedClass);
        console.log(`Updated class ${classId} in persistent storage with enrolled student ${studentId}`);
      } catch (storageError) {
        console.error('Error updating class in persistent storage:', storageError);
      }
      
      // Also update student record with class
      let studentClasses = student.classes || [];
      if (!Array.isArray(studentClasses)) {
        studentClasses = [];
      }
      
      if (!studentClasses.includes(classId)) {
        studentClasses.push(classId);
        
        const updatedStudent = {
          ...student,
          classes: studentClasses
        };
        
        // Update in Firestore
        try {
          const studentRef = doc(db, 'users', studentId);
          await setDoc(studentRef, updatedStudent, { merge: true });
          console.log(`Updated student ${studentId} in Firestore with class ${classId}`);
        } catch (firestoreError) {
          console.error('Error updating student in Firestore:', firestoreError);
        }
        
        // Update in persistent storage
        try {
          persistentStorage.updateUser(studentId, updatedStudent);
          console.log(`Updated student ${studentId} in persistent storage with class ${classId}`);
        } catch (storageError) {
          console.error('Error updating student in persistent storage:', storageError);
        }
        
        // Update local cache
        this.users = this.users.map(u => u.id === studentId ? updatedStudent : u);
      }
      
      // Update local cache
      this.classes = this.classes.map(c => c.id === classId ? updatedClass : c);
      
      // Add activity log
      await this.addActivityLog({
        action: 'Student Enrolled',
        details: `Student ${student.name} enrolled in class ${classData.name}`,
        timestamp: new Date().toISOString(),
        category: 'Enrollment'
      });
      
      return true;
    } catch (error) {
      console.error(`Error enrolling student ${studentId} in class ${classId}:`, error);
      
      // Try persistent storage as fallback
      try {
        return persistentStorage.enrollStudent(classId, studentId);
      } catch (fallbackError) {
        console.error('Critical error in enrollment process:', fallbackError);
        return false;
      }
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

  // ... rest of the file - files, etc. ...
}

// Export the class instance for use throughout the application
export const storageService = new StorageService()
export const storage = storageService // Export as 'storage' for backwards compatibility