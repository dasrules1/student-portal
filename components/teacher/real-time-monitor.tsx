"use client"

import { useState, useEffect } from "react"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { realtimeDb } from "@/lib/firebase"
import { ref, onValue, off } from "firebase/database"
import { formatDistance } from "date-fns"
import {
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Activity,
  Users
} from "lucide-react"

interface Answer {
  studentId: string
  studentName: string
  studentEmail?: string
  studentAvatar?: string
  questionId: string
  questionText: string
  answer: string
  answerType: 'multiple-choice' | 'open-ended' | 'math-expression'
  timestamp: number
  correct?: boolean
  partialCredit?: number
}

interface RealTimeMonitorProps {
  classId: string
  contentId?: string
  recentOnly?: boolean
  limitEntries?: number
}

export function RealTimeMonitor({
  classId,
  contentId,
  recentOnly = false,
  limitEntries = 20
}: RealTimeMonitorProps) {
  const [realtimeAnswers, setRealtimeAnswers] = useState<Answer[]>([])
  const [activeStudents, setActiveStudents] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Set up real-time listener for student answers
    const answersRef = contentId 
      ? ref(realtimeDb, `student-answers/${classId}/${contentId}`) 
      : ref(realtimeDb, `student-answers/${classId}`)

    const onDataChange = (snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const answers: Answer[] = []
        const studentSet = new Set<string>()
        
        // Process different content types if no specific contentId is provided
        if (!contentId) {
          Object.keys(data).forEach(contentKey => {
            Object.keys(data[contentKey]).forEach(answerKey => {
              const answer = data[contentKey][answerKey]
              
              // Add active students to the set
              if (answer.studentId) {
                studentSet.add(answer.studentId)
              }
              
              // Only include recent answers if recentOnly is true
              if (!recentOnly || Date.now() - answer.timestamp < 3600000) { // 1 hour
                answers.push(answer)
              }
            })
          })
        } else {
          // Process answers for a specific content
          Object.keys(data).forEach(answerKey => {
            const answer = data[answerKey]
            
            // Add active students to the set
            if (answer.studentId) {
              studentSet.add(answer.studentId)
            }
            
            // Only include recent answers if recentOnly is true
            if (!recentOnly || Date.now() - answer.timestamp < 3600000) { // 1 hour
              answers.push(answer)
            }
          })
        }
        
        // Sort by timestamp (newest first)
        answers.sort((a, b) => b.timestamp - a.timestamp)
        
        // Limit the number of entries if needed
        const limitedAnswers = limitEntries > 0 ? answers.slice(0, limitEntries) : answers
        
        setRealtimeAnswers(limitedAnswers)
        setActiveStudents(studentSet)
      } else {
        setRealtimeAnswers([])
        setActiveStudents(new Set())
      }
      
      setLoading(false)
    }

    onValue(answersRef, onDataChange)

    // Clean up listener on component unmount
    return () => {
      off(answersRef, 'value', onDataChange)
    }
  }, [classId, contentId, recentOnly, limitEntries])

  // Helper function to format answer display based on type
  const formatAnswer = (answer: Answer) => {
    switch (answer.answerType) {
      case 'multiple-choice':
        return `Option: ${answer.answer}`
      case 'math-expression':
        return `Expression: ${answer.answer}`
      case 'open-ended':
        return answer.answer.length > 100 
          ? `${answer.answer.substring(0, 100)}...` 
          : answer.answer
      default:
        return answer.answer
    }
  }

  // Render a status badge based on correctness
  const getStatusBadge = (answer: Answer) => {
    if (answer.correct === true) {
      return <Badge variant="success" className="flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Correct</Badge>
    } else if (answer.correct === false) {
      if (answer.partialCredit && answer.partialCredit > 0) {
        return <Badge variant="warning" className="flex items-center"><Clock className="w-3 h-3 mr-1" /> Partial Credit</Badge>
      } else {
        return <Badge variant="destructive" className="flex items-center"><XCircle className="w-3 h-3 mr-1" /> Incorrect</Badge>
      }
    } else {
      return <Badge variant="outline" className="flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Pending</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Real-Time Monitoring
          </CardTitle>
          <CardDescription>
            Loading student activity...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6">
            <div className="animate-pulse w-full max-w-md">
              <div className="h-4 bg-slate-200 rounded mb-3"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-200 rounded mb-3"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          Real-Time Student Activity
        </CardTitle>
        <CardDescription className="flex items-center">
          <Users className="w-4 h-4 mr-1" />
          {activeStudents.size} active students | {realtimeAnswers.length} responses
        </CardDescription>
      </CardHeader>
      <CardContent>
        {realtimeAnswers.length > 0 ? (
          <div className="space-y-4">
            {realtimeAnswers.map((answer, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={answer.studentAvatar || ""} />
                  <AvatarFallback>
                    {answer.studentName ? answer.studentName.charAt(0).toUpperCase() : "S"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{answer.studentName}</p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistance(answer.timestamp, Date.now(), { addSuffix: true })}
                      </span>
                      {getStatusBadge(answer)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{answer.questionText}</p>
                  <p className="text-sm">{formatAnswer(answer)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <Activity className="w-10 h-10 mb-2 text-muted-foreground" />
            <p>No student activity recorded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Student answers will appear here in real-time as they work on assignments
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 