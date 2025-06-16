import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';

// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');
initializeApp({
  credential: cert(serviceAccount)
});

async function migrateStudentAnswers() {
  try {
    // Get all existing student answers
    const answersSnapshot = await admin.firestore()
      .collection('student-answers')
      .get();
    
    // Process each answer
    for (const docSnapshot of answersSnapshot.docs) {
      const data = docSnapshot.data();
      const { classId, studentId, contentId, problemIndex } = data;
      
      if (!classId || !studentId || !contentId || problemIndex === undefined) {
        console.error('Missing required fields:', { docId: docSnapshot.id, data });
        continue;
      }
      
      // Create new document in nested structure
      const newDocRef = admin.firestore()
        .collection('student-answers')
        .doc(classId)
        .collection('answers')
        .doc(`${studentId}_${contentId}_${problemIndex}`);
      
      // Copy data to new location
      await newDocRef.set({
        ...data,
        timestamp: data.timestamp || admin.firestore.Timestamp.now()
      });
      
      // Delete old document
      await docSnapshot.ref.delete();
      
      console.log(`Migrated answer: ${docSnapshot.id} -> ${newDocRef.path}`);
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run migration
migrateStudentAnswers(); 