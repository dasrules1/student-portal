"use client"

import type React from "react"
import { AdminSidebar } from "@/components/admin/sidebar"
import { useRequireAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthorized } = useRequireAuth("admin")

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    )
  }

  // Don't render anything while redirecting
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Checking authorization...</span>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-auto w-full">{children}</main>
    </div>
  )
}
