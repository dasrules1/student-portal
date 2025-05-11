"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ClassesRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the dashboard with the classes tab active
    router.push("/teacher/dashboard?tab=classes")
  }, [router])

  return <div className="flex items-center justify-center min-h-screen">Redirecting...</div>
}
