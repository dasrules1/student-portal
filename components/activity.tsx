import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User } from "@/lib/storage"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ActivityProps {
  activities: {
    id: string
    title: string
    description: string
    timestamp: string
    type: string
    user?: User
  }[]
}

export function Activity({ activities }: ActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length > 0 ? (
            activities.map((activity) => (
              <div
                key={activity.id}
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
                    <p className="font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.description}
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