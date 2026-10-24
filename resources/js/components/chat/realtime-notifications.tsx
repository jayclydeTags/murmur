import { router, usePage } from '@inertiajs/react';
import { useEcho, useEchoNotification } from '@laravel/echo-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { showBrowserNotification } from '@/lib/chat';
import { dashboard } from '@/routes';
import { show } from '@/routes/conversations';
import type {
    ConversationActivityPayload,
    MentionNotificationData,
    SidebarConversation,
} from '@/types';

/**
 * Listens on the user's private channel to keep the sidebar live and raise
 * toasts and browser notifications for DMs and mentions.
 */
export function RealtimeNotifications({ userId }: { userId: number }) {
    const page = usePage<{ conversation?: { id: number } }>();
    const viewingId = useRef<number | null>(null);
    const sidebar = useRef<SidebarConversation[]>(page.props.sidebar);

    useEffect(() => {
        viewingId.current = page.props.conversation?.id ?? null;
        sidebar.current = page.props.sidebar;
    }, [page.props.conversation?.id, page.props.sidebar]);

    const isViewing = (conversationId: number) =>
        viewingId.current === conversationId && !document.hidden;

    useEcho<ConversationActivityPayload>(
        `App.Models.User.${userId}`,
        '.ConversationActivity',
        (payload) => {
            router.reload({ only: ['sidebar'] });

            if (
                payload.kind === 'removed' &&
                isViewing(payload.conversation_id)
            ) {
                toast.info(
                    `You were removed from ${payload.conversation_name ?? 'this conversation'}.`,
                );
                router.visit(dashboard());

                return;
            }

            if (payload.kind === 'added' && payload.sender?.id !== userId) {
                const what =
                    payload.conversation_type === 'direct'
                        ? `${payload.sender?.name ?? 'Someone'} started a conversation with you`
                        : `${payload.sender?.name ?? 'Someone'} added you to ${payload.conversation_name}`;

                toast.info(what, {
                    action: {
                        label: 'Open',
                        onClick: () =>
                            router.visit(show(payload.conversation_id)),
                    },
                });

                return;
            }

            const conversation = sidebar.current.find(
                (item) => item.id === payload.conversation_id,
            );

            const shouldAlert =
                payload.kind === 'message' &&
                payload.conversation_type === 'direct' &&
                payload.sender !== null &&
                payload.sender.id !== userId &&
                !conversation?.is_muted &&
                !isViewing(payload.conversation_id);

            if (!shouldAlert || !payload.sender) {
                return;
            }

            toast(payload.sender.name, {
                description: payload.preview,
                action: {
                    label: 'Reply',
                    onClick: () => router.visit(show(payload.conversation_id)),
                },
            });
            showBrowserNotification(payload.sender.name, payload.preview ?? '');
        },
        [userId],
    );

    useEchoNotification<MentionNotificationData>(
        `App.Models.User.${userId}`,
        (notification) => {
            router.reload({ only: ['unreadNotificationCount'] });

            if (isViewing(notification.conversation_id)) {
                return;
            }

            const title = `${notification.sender?.name ?? 'Someone'} mentioned you in ${notification.conversation_name}`;

            toast(title, {
                description: notification.excerpt,
                action: {
                    label: 'View',
                    onClick: () =>
                        router.visit(show(notification.conversation_id)),
                },
            });
            showBrowserNotification(title, notification.excerpt);
        },
        'mention',
        [userId],
    );

    return null;
}
