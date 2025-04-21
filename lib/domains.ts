// Client-side domain detection
export function isStudentDomain(hostname: string): boolean {
  return hostname.startsWith("student.") || hostname === process.env.NEXT_PUBLIC_STUDENT_DOMAIN
}

export function isStaffDomain(hostname: string): boolean {
  return hostname.startsWith("staff.") || hostname === process.env.NEXT_PUBLIC_STAFF_DOMAIN
}

export function isAdminDomain(hostname: string): boolean {
  return hostname.startsWith("admin.") || hostname === process.env.NEXT_PUBLIC_ADMIN_DOMAIN
}

// Client-side function to get current domain type
export function getCurrentDomainType(): "student" | "staff" | "admin" | "unknown" {
  const hostname = window.location.hostname

  if (isStudentDomain(hostname)) return "student"
  if (isStaffDomain(hostname)) return "staff"
  if (isAdminDomain(hostname)) return "admin"

  return "unknown"
}
