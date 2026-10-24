import { echo } from '@laravel/echo-react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PresenceStatus, UserSummary } from '@/types';

type PresenceContextValue = {
    statusOf: (userId: number) => PresenceStatus;
    onlineUsers: UserSummary[];
};

const PresenceContext = createContext<PresenceContextValue>({
    statusOf: () => 'offline',
    onlineUsers: [],
});

const AWAY_AFTER_MS = 5 * 60 * 1000;

type StatusWhisper = {
    id: number;
    status: PresenceStatus;
};

/**
 * Joins the workspace-wide presence channel and tracks who is online or away.
 */
export function PresenceProvider({
    userId,
    children,
}: {
    userId: number;
    children: ReactNode;
}) {
    const [onlineUsers, setOnlineUsers] = useState<UserSummary[]>([]);
    const [awayIds, setAwayIds] = useState<Set<number>>(() => new Set());

    useEffect(() => {
        const channel = echo().join('online');
        let ownStatus: PresenceStatus = document.hidden ? 'away' : 'online';
        let idleTimer: number | undefined;

        const broadcastStatus = (status: PresenceStatus) => {
            ownStatus = status;
            channel.whisper('status', { id: userId, status });
        };

        const setAway = (id: number, away: boolean) => {
            setAwayIds((current) => {
                if (current.has(id) === away) {
                    return current;
                }

                const next = new Set(current);

                if (away) {
                    next.add(id);
                } else {
                    next.delete(id);
                }

                return next;
            });
        };

        const markActive = () => {
            window.clearTimeout(idleTimer);
            idleTimer = window.setTimeout(() => {
                setAway(userId, true);
                broadcastStatus('away');
            }, AWAY_AFTER_MS);

            if (ownStatus !== 'online' && !document.hidden) {
                setAway(userId, false);
                broadcastStatus('online');
            }
        };

        const onVisibilityChange = () => {
            if (document.hidden) {
                setAway(userId, true);
                broadcastStatus('away');
            } else {
                markActive();
            }
        };

        channel
            .here((users: UserSummary[]) => {
                setOnlineUsers(users);

                if (ownStatus === 'away') {
                    setAway(userId, true);
                    broadcastStatus('away');
                }
            })
            .joining((user: UserSummary) => {
                setOnlineUsers((current) => [
                    ...current.filter((existing) => existing.id !== user.id),
                    user,
                ]);

                // Let the newcomer know our current status.
                if (ownStatus === 'away') {
                    broadcastStatus('away');
                }
            })
            .leaving((user: UserSummary) => {
                setOnlineUsers((current) =>
                    current.filter((existing) => existing.id !== user.id),
                );
                setAway(user.id, false);
            })
            .listenForWhisper('status', (payload: StatusWhisper) => {
                setAway(payload.id, payload.status === 'away');
            });

        const activityEvents = ['pointerdown', 'keydown', 'focus'] as const;
        activityEvents.forEach((event) =>
            window.addEventListener(event, markActive, { passive: true }),
        );
        document.addEventListener('visibilitychange', onVisibilityChange);
        markActive();

        return () => {
            window.clearTimeout(idleTimer);
            activityEvents.forEach((event) =>
                window.removeEventListener(event, markActive),
            );
            document.removeEventListener(
                'visibilitychange',
                onVisibilityChange,
            );
            echo().leave('online');
        };
    }, [userId]);

    const value = useMemo<PresenceContextValue>(() => {
        const onlineIds = new Set(onlineUsers.map((user) => user.id));

        return {
            onlineUsers,
            statusOf: (id: number) => {
                if (!onlineIds.has(id)) {
                    return 'offline';
                }

                return awayIds.has(id) ? 'away' : 'online';
            },
        };
    }, [onlineUsers, awayIds]);

    return (
        <PresenceContext.Provider value={value}>
            {children}
        </PresenceContext.Provider>
    );
}

export function usePresence(): PresenceContextValue {
    return useContext(PresenceContext);
}
