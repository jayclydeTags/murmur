import { Head, Link, router, usePage } from '@inertiajs/react';
import { AtSign, Compass, Hash, MessageSquarePlus, Users } from 'lucide-react';
import NotificationReadController from '@/actions/App/Http/Controllers/Chat/NotificationReadController';
import { NewConversationDialog } from '@/components/chat/new-conversation-dialog';
import { NewDirectMessageDialog } from '@/components/chat/new-direct-message-dialog';
import { UserAvatar } from '@/components/chat/user-avatar';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { usePresence } from '@/hooks/use-presence';
import { formatFullDate } from '@/lib/chat';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as channelsIndex } from '@/routes/channels';
import { show } from '@/routes/conversations';
import type { MentionNotificationData } from '@/types';

type Mention = {
    id: string;
    data: MentionNotificationData;
    read: boolean;
    created_at: string;
};

type SuggestedChannel = {
    id: number;
    name: string;
    description: string | null;
    member_count: number;
};

export default function Dashboard({
    mentions,
    suggestedChannels,
}: {
    mentions: Mention[];
    suggestedChannels: SuggestedChannel[];
}) {
    const { auth, sidebar } = usePage().props;
    const { onlineUsers } = usePresence();
    const unreadConversations = sidebar.filter(
        (conversation) =>
            conversation.unread_count > 0 && !conversation.is_muted,
    );
    const hasUnreadMentions = mentions.some((mention) => !mention.read);
    const othersOnline = onlineUsers.filter((user) => user.id !== auth.user.id);

    return (
        <>
            <Head title="Home" />
            <div className="mx-auto grid w-full max-w-5xl gap-8 p-4 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <Heading
                        title={`Welcome back, ${auth.user.name.split(' ')[0]}`}
                        description="Catch up on what you missed and jump back into the conversation."
                    />
                    <div className="flex flex-wrap gap-2">
                        <NewDirectMessageDialog
                            trigger={
                                <Button variant="outline">
                                    <MessageSquarePlus /> New message
                                </Button>
                            }
                        />
                        <NewConversationDialog
                            kind="channel"
                            trigger={
                                <Button>
                                    <Hash /> Create channel
                                </Button>
                            }
                        />
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="grid content-start gap-6">
                        <section
                            aria-labelledby="unread-heading"
                            className="rounded-xl border"
                        >
                            <h2
                                id="unread-heading"
                                className="border-b px-4 py-3 text-sm font-semibold"
                            >
                                Unread
                            </h2>
                            {unreadConversations.length === 0 ? (
                                <p className="px-4 py-6 text-sm text-muted-foreground">
                                    You’re all caught up. 🎉
                                </p>
                            ) : (
                                <ul className="divide-y">
                                    {unreadConversations.map((conversation) => (
                                        <li key={conversation.id}>
                                            <Link
                                                href={show(conversation.id)}
                                                className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                                            >
                                                {conversation.type ===
                                                'direct' ? (
                                                    <UserAvatar
                                                        user={{
                                                            id:
                                                                conversation.direct_user_id ??
                                                                0,
                                                            name: conversation.name,
                                                            avatar: conversation.avatar,
                                                        }}
                                                        showPresence
                                                        className="size-6"
                                                    />
                                                ) : conversation.type ===
                                                  'group' ? (
                                                    <Users
                                                        aria-hidden
                                                        className="size-4 text-muted-foreground"
                                                    />
                                                ) : (
                                                    <Hash
                                                        aria-hidden
                                                        className="size-4 text-muted-foreground"
                                                    />
                                                )}
                                                <span className="flex-1 truncate text-sm font-medium">
                                                    {conversation.name}
                                                </span>
                                                <span className="rounded-full bg-primary px-2 text-xs font-medium text-primary-foreground tabular-nums">
                                                    {conversation.unread_count}
                                                    <span className="sr-only">
                                                        {' '}
                                                        unread
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section
                            aria-labelledby="mentions-heading"
                            className="rounded-xl border"
                        >
                            <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
                                <h2
                                    id="mentions-heading"
                                    className="flex items-center gap-2 py-1 text-sm font-semibold"
                                >
                                    <AtSign aria-hidden className="size-4" />{' '}
                                    Mentions
                                </h2>
                                {hasUnreadMentions && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            router.post(
                                                NotificationReadController.store.url(),
                                                {},
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        Mark all as read
                                    </Button>
                                )}
                            </div>
                            {mentions.length === 0 ? (
                                <p className="px-4 py-6 text-sm text-muted-foreground">
                                    When someone @mentions you, it’ll show up
                                    here.
                                </p>
                            ) : (
                                <ul className="divide-y">
                                    {mentions.map((mention) => (
                                        <li key={mention.id}>
                                            <Link
                                                href={show(
                                                    mention.data
                                                        .conversation_id,
                                                )}
                                                className={cn(
                                                    'flex gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                                                    !mention.read &&
                                                        'bg-primary/5',
                                                )}
                                            >
                                                {mention.data.sender && (
                                                    <UserAvatar
                                                        user={
                                                            mention.data.sender
                                                        }
                                                    />
                                                )}
                                                <span className="grid min-w-0 flex-1 gap-0.5">
                                                    <span className="text-sm">
                                                        <strong>
                                                            {mention.data.sender
                                                                ?.name ??
                                                                'Someone'}
                                                        </strong>{' '}
                                                        mentioned you in{' '}
                                                        <strong>
                                                            {
                                                                mention.data
                                                                    .conversation_name
                                                            }
                                                        </strong>
                                                        {!mention.read && (
                                                            <span className="sr-only">
                                                                {' '}
                                                                (unread)
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="line-clamp-2 text-sm text-muted-foreground">
                                                        {mention.data.excerpt}
                                                    </span>
                                                    <time
                                                        dateTime={
                                                            mention.created_at
                                                        }
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        {formatFullDate(
                                                            mention.created_at,
                                                        )}
                                                    </time>
                                                </span>
                                                {!mention.read && (
                                                    <span
                                                        aria-hidden
                                                        className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                                                    />
                                                )}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    <aside className="grid content-start gap-6">
                        <section
                            aria-labelledby="online-heading"
                            className="rounded-xl border p-4"
                        >
                            <h2
                                id="online-heading"
                                className="text-sm font-semibold"
                            >
                                Online now{' '}
                                <span className="font-normal text-muted-foreground tabular-nums">
                                    ({othersOnline.length})
                                </span>
                            </h2>
                            {othersOnline.length === 0 ? (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Nobody else is around right now.
                                </p>
                            ) : (
                                <ul className="mt-3 grid gap-2">
                                    {othersOnline.slice(0, 12).map((user) => (
                                        <li
                                            key={user.id}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <UserAvatar
                                                user={user}
                                                showPresence
                                                className="size-6"
                                            />
                                            <span className="truncate">
                                                {user.name}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section
                            aria-labelledby="suggested-heading"
                            className="rounded-xl border p-4"
                        >
                            <h2
                                id="suggested-heading"
                                className="flex items-center gap-2 text-sm font-semibold"
                            >
                                <Compass aria-hidden className="size-4" />{' '}
                                Channels to join
                            </h2>
                            {suggestedChannels.length === 0 ? (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    You’re in every public channel.
                                </p>
                            ) : (
                                <ul className="mt-3 grid gap-3">
                                    {suggestedChannels.map((channel) => (
                                        <li key={channel.id}>
                                            <Link
                                                href={show(channel.id)}
                                                className="group grid rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                            >
                                                <span className="text-sm font-medium group-hover:underline">
                                                    #{channel.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {channel.member_count}{' '}
                                                    {channel.member_count === 1
                                                        ? 'member'
                                                        : 'members'}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <Button
                                asChild
                                variant="link"
                                className="mt-2 h-auto px-0"
                            >
                                <Link href={channelsIndex()}>
                                    Browse all channels
                                </Link>
                            </Button>
                        </section>
                    </aside>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Home',
            href: dashboard(),
        },
    ],
};
