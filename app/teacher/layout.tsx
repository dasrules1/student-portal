"use client"

import type React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { School, FileText, Users, Calendar, User, Settings, Loader2 } from "lucide-react"
import { useRequireAuth } from "@/contexts/auth-context"
import { useEffect, useState } from "react"

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthorized } = useRequireAuth("teacher")
  const [isVerified, setIsVerified] = useState(false)
  
  // Extra check for auth from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedAuth = localStorage.getItem('authUser')
        if (storedAuth) {
          const authData = JSON.parse(storedAuth)
          if (authData.role === 'teacher') {
            setIsVerified(true)
          }
        }
      } catch (e) {
        console.error('Error reading auth from localStorage:', e)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    )
  }

  // Don't render anything while redirecting
  if (!isAuthorized && !isVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Checking authorization...</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <div className="hidden w-64 p-4 bg-white border-r md:block dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center mb-8 space-x-2">
          <School className="w-6 h-6 text-primary" />
          <div className="flex flex-col">
            <span className="text-xl font-bold">Education More</span>
            <span className="text-sm text-muted-foreground">Teacher Portal</span>
          </div>
        </div>
        
        <nav className="space-y-1 mb-6">
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/dashboard">
              <FileText className="w-5 h-5 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/classes">
              <School className="w-5 h-5 mr-2" />
              Classes
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/students">
              <Users className="w-5 h-5 mr-2" />
              Students
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/calendar">
              <Calendar className="w-5 h-5 mr-2" />
              Calendar
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/profile">
              <User className="w-5 h-5 mr-2" />
              Profile
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/settings">
              <Settings className="w-5 h-5 mr-2" />
              Settings
            </Link>
          </Button>
        </nav>

        <div className="pt-4 mt-4 border-t dark:border-slate-800">
          <Button variant="outline" className="justify-start w-full" asChild>
            <Link href="/staff-portal">
              Logout
            </Link>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
} 