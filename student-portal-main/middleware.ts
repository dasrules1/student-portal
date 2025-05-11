import { type NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const { pathname, hostname } = url

  console.log("Middleware processing:", { pathname, hostname })

  // Extract subdomain (assuming format is subdomain.domain.com)
  const subdomain = hostname.split(".")[0]
  console.log("Detected subdomain:", subdomain)

  // Handle student subdomain
  if (subdomain === "student") {
    console.log("Processing student subdomain request")

    // If they're trying to access the root, redirect to student portal
    if (pathname === "/") {
      url.pathname = "/student-portal"
      console.log("Redirecting to student portal")
      return NextResponse.rewrite(url)
    }

    // If they're trying to access staff portal, redirect to student portal
    if (pathname.startsWith("/staff-portal")) {
      url.pathname = "/student-portal"
      console.log("Redirecting from staff to student portal")
      return NextResponse.redirect(url)
    }
  }

  // Handle staff subdomain
  if (subdomain === "staff" || subdomain === "admin") {
    console.log("Processing staff/admin subdomain request")

    // If they're trying to access the root, redirect to staff portal
    if (pathname === "/") {
      url.pathname = "/staff-portal"
      console.log("Redirecting to staff portal")
      return NextResponse.rewrite(url)
    }

    // If they're trying to access student portal, redirect to staff portal
    if (pathname.startsWith("/student-portal")) {
      url.pathname = "/staff-portal"
      console.log("Redirecting from student to staff portal")
      return NextResponse.redirect(url)
    }
  }

  const response = NextResponse.next()

  // Add security headers
  response.headers.set("Content-Security-Policy", "default-src 'self'")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  return response
}

// Configure matcher to run middleware only on specific paths
export const config = {
  matcher: ["/", "/student-portal", "/staff-portal", "/student-portal/:path*", "/staff-portal/:path*"],
}
