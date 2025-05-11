import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User } from "@/lib/storage"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { storage } from "@/lib/storage"

interface ActivityItem {
  id: string
  title: string
  description: string
  timestamp: string
  type?: string
  user?: User
}

interface ActivityWithArrayProps {
  activities: ActivityItem[]
  studentId?: never
}

interface ActivityWithStudentIdProps {
  studentId: string
  activities?: never
}

type ActivityProps = ActivityWithArrayProps | ActivityWithStudentIdProps

export function Activity(props: ActivityProps) {
  const [activityData, setActivityData] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If studentId is provided, fetch activities for that student
    if ('studentId' in props && props.studentId) {
      const fetchActivities = async () => {
        setLoading(true)
        try {
          // Try to get activities for this student
          let activities: ActivityItem[] = []
          
          try {
            const logs = await storage.getActivityLogs()
            if (logs && Array.isArray(logs)) {
              // Filter logs for this student
              activities = logs
                .filter(log => log.userId === props.studentId || log.studentId === props.studentId)
                .map(log => ({
                  id: log.id,
                  title: log.action || log.type || 'Activity',
                  description: log.details || '',
                  timestamp: log.timestamp,
                  type: log.type || 'activity'
                }))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 10)
            }
          } catch (err) {
            console.error("Error fetching activity logs:", err)
          }
          
          setActivityData(activities)
        } catch (err) {
          console.error("Error loading activities:", err)
          setError("Failed to load activities")
        } finally {
          setLoading(false)
        }
      }
      
      fetchActivities()
    } else if ('activities' in props && props.activities) {
      // If activities array is provided directly, use that
      setActivityData(props.activities)
    }
  }, [props])
  
  // Use the activities from props if provided, otherwise use our fetched data
  const activities = 'activities' in props && Array.isArray(props.activities) ? props.activities : activityData

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <p className="text-muted-foreground">Loading activities...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-6">
              <p className="text-muted-foreground">Failed to load activities</p>
            </div>
          ) : Array.isArray(activities) && activities.length > 0 ? (
            activities.map((activity) => (
              <div
                key={activity.id || Math.random().toString()}
                className="flex items-start space-x-4 pb-4 border-b last:border-0 last:pb-0"
              >
                {activity.user && (
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={activity.user.profileImageUrl || ""} />
                    <AvatarFallback>
                      {activity.user.name
                        ? activity.user.name.substring(0, 2).toUpperCase()
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{activity.title || "Activity"}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : "Unknown time"}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.description || "No details available"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center py-6">
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 