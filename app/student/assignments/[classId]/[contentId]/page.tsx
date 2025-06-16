"use client"

import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/components/ui/use-toast';

const AssignmentPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [classId, setClassId] = useState('');
  const [contentId, setContentId] = useState('');

  const saveAnswer = async (problemIndex: number, answer: string) => {
    if (!user || !classId || !contentId) return;

    try {
      // Create a reference to the student's answer using the new nested path structure
      const answerRef = doc(db, `student-answers/${classId}/answers/${user.uid}_${contentId}_${problemIndex}`);
      
      await setDoc(answerRef, {
        studentId: user.uid,
        classId: classId,
        contentId: contentId,
        problemIndex: problemIndex,
        answer: answer,
        timestamp: serverTimestamp(),
        score: 0,
        correct: false
      }, { merge: true });

      // Update local state
      setAnswers(prev => ({
        ...prev,
        [problemIndex]: answer
      }));

      toast({
        title: "Answer saved",
        description: "Your answer has been saved successfully.",
        duration: 3000
      });
    } catch (error) {
      console.error("Error saving answer:", error);
      toast({
        title: "Error",
        description: "There was a problem saving your answer. Please try again.",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  return (
    <div>
      {/* Render your component content here */}
    </div>
  );
};

export default AssignmentPage; 