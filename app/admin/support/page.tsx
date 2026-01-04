"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Activity, CheckCircle2, LifeBuoy, RefreshCcw, ShieldQuestion, Users as UsersIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { storage } from "@/lib/storage"
import type { ActivityLog, Class, User } from "@/lib/types"

export default function AdminSupportPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const [clientInfo, setClientInfo] = useState({
    timezone: "",
    online: true,
    userAgent: "",
  })

  useEffect(() => {
    setClientInfo({
      timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Unknown",
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Unavailable",
    })
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [loadedUsers, loadedClasses, loadedLogs] = await Promise.all([
        storage.getUsers(),
        storage.getClasses(),
        storage.getSafeActivityLogs(),
      ])

      setUsers(Array.isArray(loadedUsers) ? loadedUsers : [])
      setClasses(Array.isArray(loadedClasses) ? loadedClasses : [])
      setActivityLogs(Array.isArray(loadedLogs) ? loadedLogs : [])
      setLastUpdated(new Date().toLocaleString())
    } catch (error: unknown) {
      console.error("Error loading support data:", error)
      const message = error instanceof Error ? error.message : "Check your connection and try again."
      toast({
        title: "Unable to load support data",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const userClassMap = useMemo(() => {
    const map = new Map<string, { enrolled: number; teaching: number }>()
    users.forEach((user) => map.set(user.id, { enrolled: 0, teaching: 0 }))

    classes.forEach((cls) => {
      if (cls.teacher_id) {
        const entry = map.get(cls.teacher_id)
        if (entry) entry.teaching += 1
      }

      if (Array.isArray(cls.enrolledStudents)) {
        cls.enrolledStudents.forEach((studentId) => {
          const entry = map.get(studentId)
          if (entry) entry.enrolled += 1
        })
      }
    })

    return map
  }, [classes, users])

  const duplicateEmails = useMemo(() => {
    const emailMap = new Map<string, User[]>()
    users.forEach((user) => {
      if (!user.email) return
      const list = emailMap.get(user.email) || []
      list.push(user)
      emailMap.set(user.email, list)
    })
    return Array.from(emailMap.values()).filter((list) => list.length > 1)
  }, [users])

  const usersWithoutClasses = useMemo(() => {
    return users.filter((user) => {
      const mapping = userClassMap.get(user.id)
      const totalClasses = (mapping?.enrolled || 0) + (mapping?.teaching || 0) + (user.classes?.length || 0)
      return totalClasses === 0
    })
  }, [userClassMap, users])

  const classesMissingDetails = useMemo(() => {
    return classes.filter((cls) => !cls.teacher || !cls.studentJoinLink || !cls.teacherJoinLink)
  }, [classes])

  const issues = useMemo(() => {
    const items: { title: string; description: string }[] = []

    if (duplicateEmails.length > 0) {
      items.push({
        title: "Duplicate email addresses detected",
        description: `${duplicateEmails.length} email(s) are shared by multiple accounts. This can block login and password resets.`,
      })
    }

    const missingEmails = users.filter((user) => !user.email)
    if (missingEmails.length > 0) {
      items.push({
        title: "Accounts missing email addresses",
        description: `${missingEmails.length} user(s) do not have an email on file.`,
      })
    }

    const inactiveUsers = users.filter((user) => user.status === "inactive")
    if (inactiveUsers.length > 0) {
      items.push({
        title: "Inactive accounts",
        description: `${inactiveUsers.length} account(s) are marked inactive and may be unable to sign in.`,
      })
    }

    if (usersWithoutClasses.length > 0) {
      items.push({
        title: "Users without any class assignments",
        description: `${usersWithoutClasses.length} user(s) are not teaching or enrolled in any class.`,
      })
    }

    if (classesMissingDetails.length > 0) {
      items.push({
        title: "Classes with incomplete details",
        description: `${classesMissingDetails.length} class(es) are missing join links or scheduling info.`,
      })
    }

    return items
  }, [classesMissingDetails.length, duplicateEmails.length, users, usersWithoutClasses.length])

  const stats = [
    {
      label: "Total Users",
      value: users.length,
      icon: UsersIcon,
    },
    {
      label: "Students",
      value: users.filter((user) => user.role === "student").length,
      icon: Activity,
    },
    {
      label: "Teachers",
      value: users.filter((user) => user.role === "teacher").length,
      icon: CheckCircle2,
    },
    {
      label: "Admins",
      value: users.filter((user) => user.role === "admin").length,
      icon: ShieldQuestion,
    },
    {
      label: "Active Classes",
      value: classes.length,
      icon: LifeBuoy,
    },
    {
      label: "Potential Issues",
      value: issues.length,
      icon: AlertCircle,
    },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LifeBuoy className="w-7 h-7 text-primary" />
            Support & Diagnostics
          </h1>
          <p className="text-muted-foreground">
            Quickly troubleshoot user issues, review debug details, and see system health for every account.
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">Last refreshed: {lastUpdated}</p>
          )}
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh data
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Potential user blockers</CardTitle>
                <CardDescription>Find data issues that commonly cause login or access errors.</CardDescription>
              </div>
              <Badge variant={issues.length > 0 ? "destructive" : "secondary"}>
                {issues.length > 0 ? `${issues.length} issue(s)` : "No issues detected"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Checking for issues...</p>
            ) : issues.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                No blocking data issues detected.
              </div>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue.title}
                  className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3"
                >
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium">{issue.title}</p>
                    <p className="text-sm text-muted-foreground">{issue.description}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug context</CardTitle>
            <CardDescription>Information support can share with users while troubleshooting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timezone</span>
              <span>{clientInfo.timezone || "Unknown"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network status</span>
              <Badge variant={clientInfo.online ? "secondary" : "destructive"}>
                {clientInfo.online ? "Online" : "Offline"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User agent</span>
              <span className="max-w-xs text-right truncate" title={clientInfo.userAgent}>
                {clientInfo.userAgent}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loaded users</span>
              <span>{users.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loaded classes</span>
              <span>{classes.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>Contact and access details for every account.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Classes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const mapping = userClassMap.get(user.id)
                  const totalClasses = (mapping?.enrolled || 0) + (mapping?.teaching || 0) + (user.classes?.length || 0)
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || "Unnamed user"}</TableCell>
                      <TableCell>{user.email || <span className="text-muted-foreground">No email on file</span>}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.role || "unknown"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "inactive" ? "destructive" : "outline"}>
                          {user.status || "active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap text-xs text-muted-foreground">
                          <span>{totalClasses} total</span>
                          {mapping?.enrolled ? <Badge variant="outline">Enrolled: {mapping.enrolled}</Badge> : null}
                          {mapping?.teaching ? <Badge variant="outline">Teaching: {mapping.teaching}</Badge> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest system events to help trace user actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          ) : activityLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity logs available.</p>
          ) : (
            activityLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-start gap-3 rounded-md border p-3">
                <Activity className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{log.action}</p>
                  <p className="text-sm text-muted-foreground">{log.details}</p>
                  <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
