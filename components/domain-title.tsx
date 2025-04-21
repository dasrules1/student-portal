"use client"

import { useEffect } from "react"
import { getCurrentDomainType } from "@/lib/domains"

export function DomainTitle() {
  useEffect(() => {
    const domainType = getCurrentDomainType()
    let pageTitle = "Education More"

    if (domainType === "student") {
      pageTitle = "Student Portal | Education More"
    } else if (domainType === "staff") {
      pageTitle = "Staff Portal | Education More"
    } else if (domainType === "admin") {
      pageTitle = "Admin Portal | Education More"
    }

    document.title = pageTitle
  }, [])

  return null
}
