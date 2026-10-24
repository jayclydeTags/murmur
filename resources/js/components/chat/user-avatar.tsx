import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { usePresence } from '@/hooks/use-presence';
import { cn } from '@/lib/utils';
import type { PresenceStatus } from '@/types';

const statusLabels: Record<PresenceStatus, string> = {
    online: 'Online',
    away: 'Away',
    offline: 'Offline',
};

export function PresenceDot({
    status,
    className,
}: {
    status: PresenceStatus;
    className?: string;
}) {
    return (
        <span
            role="img"
            aria-label={statusLabels[status]}
            title={statusLabels[status]}
            className={cn(
                'block size-2.5 rounded-full ring-2 ring-background',
                status === 'online' && 'bg-emerald-500',
                status === 'away' && 'border-2 border-amber-500 bg-background',
                status === 'offline' &&
                    'border-2 border-muted-foreground/50 bg-background',
                className,
            )}
        />
    );
}

export function UserAvatar({
    user,
    className,
    showPresence = false,
}: {
    user: { id: number; name: string; avatar: string | null };
    className?: string;
    showPresence?: boolean;
}) {
    const getInitials = useInitials();
    const { statusOf } = usePresence();

    return (
        <span className="relative inline-flex shrink-0">
            <Avatar
                className={cn('size-8 overflow-hidden rounded-md', className)}
            >
                {user.avatar && <AvatarImage src={user.avatar} alt="" />}
                <AvatarFallback className="rounded-md bg-neutral-200 text-xs font-medium text-black dark:bg-neutral-700 dark:text-white">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            {showPresence && (
                <PresenceDot
                    status={statusOf(user.id)}
                    className="absolute -right-0.5 -bottom-0.5"
                />
            )}
        </span>
    );
}

export function StatusLabel({ userId }: { userId: number }) {
    const { statusOf } = usePresence();
    const status = statusOf(userId);

    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <PresenceDot status={status} className="ring-0" />
            {statusLabels[status]}
        </span>
    );
}
