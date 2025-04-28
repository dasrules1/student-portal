const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createClass() {
  try {
    // Create the class with the specific ID
    const classRef = db.collection('classes').doc('AV7NTKJnp5xDMuzQ5Ou3');
    
    await classRef.set({
      name: "Sample Class",
      teacher: "John Doe",
      teacher_id: "teacher_1",
      location: "Room 101",
      meetingDates: "Monday, Wednesday, Friday",
      startDate: "2024-01-01",
      endDate: "2024-05-31",
      startTime: "09:00 AM",
      endTime: "10:30 AM",
      virtualLink: "https://meet.google.com/sample",
      status: "active",
      students: 0,
      enrolledStudents: [],
      subject: "Mathematics",
      meeting_day: "MWF",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Class created successfully with ID: AV7NTKJnp5xDMuzQ5Ou3');
    process.exit(0);
  } catch (error) {
    console.error('Error creating class:', error);
    process.exit(1);
  }
}

createClass(); 