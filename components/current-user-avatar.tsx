'use client'

import { useCurrentUserImage } from '@/hooks/use-current-user-image'
import { useCurrentUserName } from '@/hooks/use-current-user-name'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User } from 'lucide-react'

export const CurrentUserAvatar = () => {
  const profileImage = useCurrentUserImage()
  const name = useCurrentUserName()
  const initials = name
    ?.split(' ')
    ?.map((word) => word[0])
    ?.join('')
    ?.toUpperCase()

  return (
    <Avatar>
      {profileImage && <AvatarImage src={profileImage} alt={initials || 'Avatar utilisateur'} />}
      <AvatarFallback className="bg-gray-100 dark:bg-gray-800">
        {initials && initials !== '?' ? (
          <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">
            {initials}
          </span>
        ) : (
          <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        )}
      </AvatarFallback>
    </Avatar>
  )
}
