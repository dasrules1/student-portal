// Global declarations for types used across the application

// Extend the StorageService class to include the listFilesById method
interface StorageService {
  listFilesById(id: string): string[];
}

// Firebase Storage interfaces
interface FirebaseStorage {}

interface StorageReference {
  fullPath: string;
}

// Firebase Firestore interfaces
interface DocumentData {
  [field: string]: any;
}

interface QueryDocumentSnapshot {
  id: string;
  data(): DocumentData;
  exists(): boolean;
}

interface DocumentReference {
  id: string;
} 