// Type declarations for Firebase modules

declare module 'firebase/firestore' {
  export interface DocumentData {
    [field: string]: any;
  }
  
  export interface QueryDocumentSnapshot {
    id: string;
    data(): DocumentData;
    exists(): boolean;
  }
  
  export interface DocumentReference {
    id: string;
  }
  
  export function collection(db: any, collectionPath: string): any;
  export function doc(db: any, collectionPath: string, docPath: string): any;
  export function getDocs(query: any): Promise<{docs: QueryDocumentSnapshot[]}>;
  export function getDoc(documentRef: any): Promise<QueryDocumentSnapshot>;
  export function addDoc(collectionRef: any, data: any): Promise<{id: string}>;
  export function updateDoc(documentRef: any, data: any): Promise<void>;
  export function deleteDoc(documentRef: any): Promise<void>;
  export function query(collectionRef: any, ...constraints: any[]): any;
  export function where(field: string, opStr: string, value: any): any;
  export function serverTimestamp(): any;
  export function setDoc(documentRef: any, data: any): Promise<void>;
}

declare module 'firebase/storage' {
  export interface StorageReference {
    fullPath: string;
  }
  
  export interface FirebaseStorage {}
  
  export function ref(storage: any, path?: string): StorageReference;
  export function uploadBytes(storageRef: StorageReference, data: any): Promise<{ref: StorageReference}>;
  export function getDownloadURL(storageRef: StorageReference): Promise<string>;
  export function deleteObject(storageRef: StorageReference): Promise<void>;
  export function listAll(storageRef: StorageReference): Promise<{items: StorageReference[]}>;
}
