import { User } from 'lucide-react';
import type { Profile } from '@/lib/types';

interface AvatarProps {
  profile?: Pick<Profile, 'avatar_url' | 'full_name'> | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
};

export function Avatar({ profile, size = 'md', className = '' }: AvatarProps) {
  const initials = (profile?.full_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.full_name}
        className={`rounded-full object-cover ring-1 ring-ink-200 ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`grid place-items-center rounded-full bg-sand-200 text-sand-800 ring-1 ring-sand-300 ${sizeClasses[size]} ${className}`}
    >
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}
