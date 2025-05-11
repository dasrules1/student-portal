import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container flex flex-col items-center justify-center min-h-screen px-4 py-12 mx-auto">
        <div className="space-y-6 text-center">
          <div className="flex items-center mb-8 space-x-3">
            <GraduationCap className="w-12 h-12 text-teal-600 dark:text-teal-400" />
            <h1 className="text-4xl font-bold text-teal-600 dark:text-teal-400">Education More</h1>
          </div>
          <p className="max-w-[600px] text-gray-600 md:text-xl dark:text-gray-300">
            Empowering education through innovative learning solutions
          </p>
        </div>
        <div className="grid w-full max-w-4xl grid-cols-1 gap-6 mt-12 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Student Portal</CardTitle>
              <CardDescription>Access your assignments and track your progress</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Assignment dashboard
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Real-time work submission
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Status tracking
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Notifications
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                <Link href="/student-portal">Student Login</Link>
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Admin Portal</CardTitle>
              <CardDescription>System administration and management</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  User management
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Class administration
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  System configuration
                </li>
                <li className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Reporting and analytics
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
                <Link href="/staff-portal">Admin Login</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        <div className="mt-12 text-center text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Education More. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
