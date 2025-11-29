"use client"

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/components/ui/use-toast';

const AssignmentPage: React.FC = () => {
  const params = useParams<{ classId: string; contentId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const classId = params.classId;
  const contentId = params.contentId;
  
  useEffect(() => {
    if (classId && contentId) {
      console.log('Assignment page loaded with:', { classId, contentId });
    }
  }, [classId, contentId]);

  const saveAnswer = async (problemIndex: number, answer: string) => {
    if (!user || !classId || !contentId) return;

    try {
      // Use standardized document ID format: ${contentId}_${studentId}_problem-${problemIndex}
      const docId = `${contentId}_${user.uid}_problem-${problemIndex}`;
      const answerRef = doc(db, 'student-answers', classId, 'answers', docId);
      
      // Use standardized schema matching the main curriculum page
      await setDoc(answerRef, {
        // Required fields for real-time matching
        studentId: user.uid,
        classId: classId,
        contentId: contentId,
        problemIndex: problemIndex,
        
        // Answer data
        answer: answer,
        answerType: 'multiple-choice', // Default, adjust if needed
        correct: false,
        score: 0,
        
        // Metadata
        updatedAt: serverTimestamp(),
        timestamp: serverTimestamp() // Keep for backwards compatibility
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