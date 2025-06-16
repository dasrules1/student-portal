"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const app_1 = require("firebase-admin/app");
// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');
(0, app_1.initializeApp)({
    credential: (0, app_1.cert)(serviceAccount)
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
    }
    catch (error) {
        console.error('Error during migration:', error);
    }
}
// Run migration
migrateStudentAnswers();
