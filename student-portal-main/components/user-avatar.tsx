import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserAvatarProps {
  name: string
  email: string
  image?: string
}

export function UserAvatar({ name, email, image }: UserAvatarProps) {
  // Generate initials from name
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)

  return <Avatar>{image ? <AvatarImage src={image} alt={name} /> : <AvatarFallback>{initials}</AvatarFallback>}</Avatar>
}
