"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CalendarRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the dashboard with the content tab active
    router.push("/teacher/dashboard?tab=content")
  }, [router])

  return <div className="flex items-center justify-center min-h-screen">Redirecting...</div>
}
