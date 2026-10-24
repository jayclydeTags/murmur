import { Head, router, setLayoutProps, usePage } from '@inertiajs/react';
import { ArrowDown, BellOff, Hash, Info, Lock, Pin, Users } from 'lucide-react';
import {
    Fragment,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { toast } from 'sonner';
import ConversationMembershipController from '@/actions/App/Http/Controllers/Chat/ConversationMembershipController';
import MessageController from '@/actions/App/Http/Controllers/Chat/MessageController';
import MessagePinController from '@/actions/App/Http/Controllers/Chat/MessagePinController';
import MessageReactionController from '@/actions/App/Http/Controllers/Chat/MessageReactionController';
import MessageReadController from '@/actions/App/Http/Controllers/Chat/MessageReadController';
import MessageReplyController from '@/actions/App/Http/Controllers/Chat/MessageReplyController';
import MessageReportController from '@/actions/App/Http/Controllers/Chat/MessageReportController';
import { ChatContext } from '@/components/chat/chat-context';
import type {
    ChatActions,
    ChatContextValue,
} from '@/components/chat/chat-context';
import { Composer } from '@/components/chat/composer';
import { ConversationChannel } from '@/components/chat/conversation-channel';
import type {
    ConversationChannelHandlers,
    TypingWhisper,
} from '@/components/chat/conversation-channel';
import { ConversationDetails } from '@/components/chat/conversation-details';
import type { DetailsTab } from '@/components/chat/conversation-details';
import { MessageItem } from '@/components/chat/message-item';
import { ThreadPanel } from '@/components/chat/thread-panel';
import type { ThreadState } from '@/components/chat/thread-panel';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { StatusLabel, UserAvatar } from '@/components/chat/user-avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
    conversationLabel,
    formatDay,
    isContinuation,
    optimisticMessage,
    upsertMessages,
} from '@/lib/chat';
import { errorMessage, request } from '@/lib/http';
import { dashboard } from '@/routes';
import { index as channelsIndex } from '@/routes/channels';
import { show } from '@/routes/conversations';
import type {
    ChatMessage,
    Conversation,
    ConversationMemberSummary,
    ConversationPermissions,
    Membership,
    Message,
    MessageReport,
    UserSummary,
} from '@/types';

type Props = {
    conversation: Conversation;
    membership: Membership | null;
    members: ConversationMemberSummary[];
    messages: Message[];
    nextCursor: string | null;
    pinned: Message[];
    reports: MessageReport[];
    can: ConversationPermissions;
};

type MessagePage = {
    data: Message[];
    next_cursor: string | null;
};

const TYPING_TIMEOUT_MS = 4000;

export default function ConversationShow(props: Props) {
    const sectionTitle =
        props.conversation.type === 'channel'
            ? 'Channels'
            : props.conversation.type === 'group'
              ? 'Groups'
              : 'Direct messages';

    setLayoutProps({
        breadcrumbs: [
            {
                title: sectionTitle,
                href:
                    props.conversation.type === 'channel'
                        ? channelsIndex()
                        : dashboard(),
            },
            {
                title: conversationLabel(props.conversation),
                href: show(props.conversation.id),
            },
        ],
    });

    return <ConversationView key={props.conversation.id} {...props} />;
}

function ConversationView({
    conversation,
    membership,
    members,
    messages: initialMessages,
    nextCursor: initialCursor,
    pinned: initialPinned,
    reports,
    can,
}: Props) {
    const { auth } = usePage().props;
    const currentUser = auth.user;
    const me: UserSummary = {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar ?? null,
    };

    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [cursor, setCursor] = useState(initialCursor);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [olderFailed, setOlderFailed] = useState(false);
    const [pinned, setPinned] = useState<ChatMessage[]>(initialPinned);
    const [readPositions, setReadPositions] = useState<Record<number, number>>(
        () =>
            Object.fromEntries(
                members.map((member) => [
                    member.id,
                    member.last_read_message_id ?? 0,
                ]),
            ),
    );
    const [typing, setTyping] = useState<
        Record<number, { name: string; parentId: number | null; until: number }>
    >({});
    const [thread, setThread] = useState<ThreadState | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsTab, setDetailsTab] = useState<DetailsTab>('about');
    const [showJump, setShowJump] = useState(false);
    const [highlightedId, setHighlightedId] = useState<number | null>(null);

    const scroller = useRef<HTMLDivElement>(null);
    const topSentinel = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);
    const prependAnchor = useRef<{ height: number; top: number } | null>(null);
    const whisper = useRef<((payload: TypingWhisper) => void) | null>(null);
    const lastReadSent = useRef(membership?.last_read_message_id ?? 0);
    const threadRef = useRef(thread);
    const unreadMarkerId = useRef<number | null>(
        initialMessages.find(
            (message) =>
                message.id >
                    (membership?.last_read_message_id ??
                        Number.MAX_SAFE_INTEGER) &&
                message.user?.id !== currentUser.id,
        )?.id ?? null,
    );

    useEffect(() => {
        threadRef.current = thread;
    }, [thread]);

    // Keep read positions in sync when the member list reloads.
    useEffect(() => {
        setReadPositions((current) => {
            const next = { ...current };

            for (const member of members) {
                next[member.id] = Math.max(
                    next[member.id] ?? 0,
                    member.last_read_message_id ?? 0,
                );
            }

            return next;
        });
    }, [members]);

    // Scroll: keep the view pinned to the bottom, or anchored when older history is prepended.
    useLayoutEffect(() => {
        const element = scroller.current;

        if (!element) {
            return;
        }

        if (prependAnchor.current) {
            element.scrollTop =
                element.scrollHeight -
                prependAnchor.current.height +
                prependAnchor.current.top;
            prependAnchor.current = null;
        } else if (stickToBottom.current) {
            element.scrollTop = element.scrollHeight;
        }
    }, [messages]);

    const onScroll = () => {
        const element = scroller.current;

        if (!element) {
            return;
        }

        const distance =
            element.scrollHeight - element.scrollTop - element.clientHeight;
        stickToBottom.current = distance < 80;
        setShowJump(distance > 400);
    };

    const jumpToLatest = () => {
        const element = scroller.current;
        const reduceMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        element?.scrollTo({
            top: element.scrollHeight,
            behavior: reduceMotion ? 'auto' : 'smooth',
        });
    };

    const loadOlder = useCallback(async () => {
        if (!cursor || loadingOlder) {
            return;
        }

        setLoadingOlder(true);
        setOlderFailed(false);

        try {
            const page = await request<MessagePage>(
                MessageController.index(conversation.id, { query: { cursor } }),
            );
            const element = scroller.current;

            if (element) {
                prependAnchor.current = {
                    height: element.scrollHeight,
                    top: element.scrollTop,
                };
            }

            setMessages((current) => upsertMessages(current, page.data));
            setCursor(page.next_cursor);
        } catch {
            setOlderFailed(true);
        } finally {
            setLoadingOlder(false);
        }
    }, [conversation.id, cursor, loadingOlder]);

    // Infinite scroll upwards through history.
    useEffect(() => {
        const sentinel = topSentinel.current;

        if (!sentinel || !cursor) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    void loadOlder();
                }
            },
            { root: scroller.current, rootMargin: '300px 0px 0px 0px' },
        );

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [cursor, loadOlder]);

    // Tell the server (and everyone else) how far we've read while the tab is visible.
    const latestPersistedId = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index--) {
            if (messages[index].status === undefined) {
                return messages[index].id;
            }
        }

        return 0;
    }, [messages]);

    useEffect(() => {
        if (!membership) {
            return;
        }

        const markRead = () => {
            if (document.hidden || latestPersistedId <= lastReadSent.current) {
                return;
            }

            lastReadSent.current = latestPersistedId;
            setReadPositions((current) => ({
                ...current,
                [currentUser.id]: latestPersistedId,
            }));
            request(MessageReadController.store(conversation.id), {
                message_id: latestPersistedId,
            }).catch(() => {
                lastReadSent.current = 0;
            });
        };

        const timer = window.setTimeout(markRead, 400);
        document.addEventListener('visibilitychange', markRead);

        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', markRead);
        };
    }, [latestPersistedId, membership, conversation.id, currentUser.id]);

    // Expire stale typing indicators.
    useEffect(() => {
        if (Object.keys(typing).length === 0) {
            return;
        }

        const timer = window.setInterval(() => {
            setTyping((current) => {
                const now = Date.now();
                const next = Object.fromEntries(
                    Object.entries(current).filter(
                        ([, entry]) => entry.until > now,
                    ),
                );

                return Object.keys(next).length === Object.keys(current).length
                    ? current
                    : next;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [typing]);

    const updateEverywhere = useCallback((message: ChatMessage) => {
        if (message.parent_id === null) {
            setMessages((current) =>
                current.some((existing) => existing.id === message.id)
                    ? upsertMessages(current, [message])
                    : current,
            );
            setPinned((current) => {
                const without = current.filter(
                    (existing) => existing.id !== message.id,
                );

                return message.is_pinned ? [message, ...without] : without;
            });
        }

        setThread((current) => {
            if (!current) {
                return current;
            }

            if (current.parent.id === message.id) {
                return { ...current, parent: message };
            }

            if (message.parent_id === current.parent.id) {
                return {
                    ...current,
                    replies: upsertMessages(current.replies, [message]),
                };
            }

            return current;
        });
    }, []);

    const removeLocally = useCallback((messageId: number) => {
        setMessages((current) =>
            current.filter((message) => message.id !== messageId),
        );
        setPinned((current) =>
            current.filter((message) => message.id !== messageId),
        );
        setThread((current) => {
            if (!current) {
                return current;
            }

            if (current.parent.id === messageId) {
                toast.info('The thread’s original message was deleted.');

                return null;
            }

            return {
                ...current,
                replies: current.replies.filter(
                    (reply) => reply.id !== messageId,
                ),
            };
        });
    }, []);

    const handlers: ConversationChannelHandlers = {
        onMessageSent: ({ message, client_id }) => {
            const incoming: ChatMessage = {
                ...message,
                client_id: client_id ?? undefined,
            };

            if (message.parent_id === null) {
                if (message.user?.id === currentUser.id) {
                    stickToBottom.current = true;
                }

                setMessages((current) => upsertMessages(current, [incoming]));
            } else {
                setThread((current) =>
                    current && current.parent.id === message.parent_id
                        ? {
                              ...current,
                              replies: upsertMessages(current.replies, [
                                  incoming,
                              ]),
                          }
                        : current,
                );
            }

            if (message.user) {
                const authorId = message.user.id;
                setTyping((current) => {
                    if (!(authorId in current)) {
                        return current;
                    }

                    const next = { ...current };
                    delete next[authorId];

                    return next;
                });
            }
        },
        onMessageUpdated: ({ message }) => updateEverywhere(message),
        onMessageDeleted: ({ message_id }) => removeLocally(message_id),
        onMessageRead: ({ user_id, message_id }) => {
            setReadPositions((current) => ({
                ...current,
                [user_id]: Math.max(current[user_id] ?? 0, message_id),
            }));
        },
        onConversationUpdated: () => {
            router.reload({
                only: [
                    'conversation',
                    'members',
                    'membership',
                    'can',
                    'reports',
                    'sidebar',
                ],
            });
        },
        onTyping: (payload) => {
            if (payload.id === currentUser.id) {
                return;
            }

            setTyping((current) => ({
                ...current,
                [payload.id]: {
                    name: payload.name,
                    parentId: payload.parent_id,
                    until: Date.now() + TYPING_TIMEOUT_MS,
                },
            }));
        },
    };

    const registerWhisper = useCallback(
        (send: (payload: TypingWhisper) => void) => {
            whisper.current = send;
        },
        [],
    );

    const sendTyping = (parentId: number | null) => {
        whisper.current?.({
            id: currentUser.id,
            name: currentUser.name,
            parent_id: parentId,
        });
    };

    const deliver = useCallback(
        async (pending: ChatMessage) => {
            const form = new FormData();

            if (pending.body) {
                form.append('body', pending.body);
            }

            pending.pending_files?.forEach((file) =>
                form.append('files[]', file),
            );

            if (pending.parent_id) {
                form.append('parent_id', String(pending.parent_id));
            }

            form.append('client_id', pending.client_id ?? '');

            const place = (message: ChatMessage) => {
                if (message.parent_id === null) {
                    setMessages((current) =>
                        upsertMessages(current, [message]),
                    );
                } else {
                    setThread((current) =>
                        current && current.parent.id === message.parent_id
                            ? {
                                  ...current,
                                  replies: upsertMessages(current.replies, [
                                      message,
                                  ]),
                              }
                            : current,
                    );
                }
            };

            place(pending);

            try {
                const response = await request<{
                    data: Message;
                    client_id: string | null;
                }>(MessageController.store(conversation.id), form);
                place({ ...response.data, client_id: pending.client_id });
            } catch (error) {
                toast.error(errorMessage(error));
                place({ ...pending, status: 'failed' });
            }
        },
        [conversation.id],
    );

    const send = (body: string, files: File[], parentId: number | null) => {
        if (parentId === null) {
            stickToBottom.current = true;
        }

        void deliver(
            optimisticMessage(me, conversation.id, body, files, parentId),
        );
    };

    const openThread = useCallback(async (message: ChatMessage) => {
        setThread({
            parent: message,
            replies: [],
            loading: true,
            failed: false,
        });

        try {
            const response = await request<{
                parent: Message;
                replies: Message[];
            }>(MessageReplyController.index(message.id));
            setThread((current) =>
                current && current.parent.id === message.id
                    ? {
                          parent: response.parent,
                          replies: upsertMessages(
                              current.replies,
                              response.replies,
                          ),
                          loading: false,
                          failed: false,
                      }
                    : current,
            );
        } catch {
            setThread((current) =>
                current && current.parent.id === message.id
                    ? { ...current, loading: false, failed: true }
                    : current,
            );
        }
    }, []);

    const actions: ChatActions = useMemo(
        () => ({
            toggleReaction: (message, emoji) => {
                const optimistic = (() => {
                    const existing = message.reactions.find(
                        (reaction) => reaction.emoji === emoji,
                    );
                    const reacted =
                        existing?.user_ids.includes(currentUser.id) ?? false;
                    const reactions = reacted
                        ? message.reactions
                              .map((reaction) =>
                                  reaction.emoji === emoji
                                      ? {
                                            ...reaction,
                                            count: reaction.count - 1,
                                            user_ids: reaction.user_ids.filter(
                                                (id) => id !== currentUser.id,
                                            ),
                                        }
                                      : reaction,
                              )
                              .filter((reaction) => reaction.count > 0)
                        : existing
                          ? message.reactions.map((reaction) =>
                                reaction.emoji === emoji
                                    ? {
                                          ...reaction,
                                          count: reaction.count + 1,
                                          user_ids: [
                                              ...reaction.user_ids,
                                              currentUser.id,
                                          ],
                                      }
                                    : reaction,
                            )
                          : [
                                ...message.reactions,
                                { emoji, count: 1, user_ids: [currentUser.id] },
                            ];

                    return { ...message, reactions };
                })();

                updateEverywhere(optimistic);
                request<{ data: Message }>(
                    MessageReactionController.store(message.id),
                    { emoji },
                )
                    .then((response) => updateEverywhere(response.data))
                    .catch((error: unknown) => {
                        updateEverywhere(message);
                        toast.error(errorMessage(error));
                    });
            },
            togglePin: (message) => {
                const endpoint = message.is_pinned
                    ? MessagePinController.destroy(message.id)
                    : MessagePinController.store(message.id);

                request<{ data: Message }>(endpoint)
                    .then((response) => {
                        updateEverywhere(response.data);
                        toast.success(
                            response.data.is_pinned
                                ? 'Message pinned.'
                                : 'Message unpinned.',
                        );
                    })
                    .catch((error: unknown) =>
                        toast.error(errorMessage(error)),
                    );
            },
            edit: async (message, body) => {
                updateEverywhere({ ...message, body, is_edited: true });

                try {
                    const response = await request<{ data: Message }>(
                        MessageController.update(message.id),
                        { body },
                    );
                    updateEverywhere(response.data);
                } catch (error) {
                    updateEverywhere(message);
                    throw error;
                }
            },
            remove: async (message) => {
                await request(MessageController.destroy(message.id));
                removeLocally(message.id);
            },
            report: async (message, reason) => {
                const response = await request<{ message: string }>(
                    MessageReportController.store(message.id),
                    { reason },
                );
                toast.success(response.message);
            },
            openThread: (message) => void openThread(message),
            retry: (message) => void deliver({ ...message, status: 'sending' }),
            discard: (message) => {
                const remove = (list: ChatMessage[]) =>
                    list.filter(
                        (existing) => existing.client_id !== message.client_id,
                    );
                setMessages(remove);
                setThread((current) =>
                    current
                        ? { ...current, replies: remove(current.replies) }
                        : current,
                );
            },
        }),
        [currentUser.id, deliver, openThread, removeLocally, updateEverywhere],
    );

    const contextValue: ChatContextValue = {
        currentUser,
        members,
        membership,
        can,
        actions,
    };

    const readersByMessage = useMemo(() => {
        const result: Record<number, UserSummary[]> = {};
        const persisted = messages.filter(
            (message) => message.status === undefined,
        );

        for (const member of members) {
            const position = readPositions[member.id] ?? 0;

            if (member.id === currentUser.id || position === 0) {
                continue;
            }

            const lastSeen = [...persisted]
                .reverse()
                .find((message) => message.id <= position);

            if (lastSeen && lastSeen.user?.id !== member.id) {
                (result[lastSeen.id] ??= []).push(member);
            }
        }

        return result;
    }, [messages, members, readPositions, currentUser.id]);

    const typingNames = (parentId: number | null) =>
        Object.values(typing)
            .filter((entry) => entry.parentId === parentId)
            .map((entry) => entry.name);

    const jumpToMessage = (message: ChatMessage) => {
        setDetailsOpen(false);
        const element = document.getElementById(`message-${message.id}`);

        if (!element) {
            toast.info(
                'That message is further back in history. Scroll up to load it.',
            );

            return;
        }

        element.scrollIntoView({ block: 'center' });
        setHighlightedId(message.id);
        window.setTimeout(() => setHighlightedId(null), 2000);
    };

    const openDetails = (tab: DetailsTab) => {
        setDetailsTab(tab);
        setDetailsOpen(true);
    };

    const label = conversationLabel(conversation);
    const directMember =
        conversation.type === 'direct'
            ? members.find(
                  (member) => member.id === conversation.direct_user_id,
              )
            : undefined;
    const HeaderIcon =
        conversation.type === 'group'
            ? Users
            : conversation.is_private
              ? Lock
              : Hash;

    return (
        <ChatContext.Provider value={contextValue}>
            <Head title={label} />

            {membership && (
                <ConversationChannel
                    conversationId={conversation.id}
                    handlers={handlers}
                    onReady={registerWhisper}
                />
            )}

            <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
                    {directMember ? (
                        <UserAvatar user={directMember} showPresence />
                    ) : (
                        <HeaderIcon
                            aria-hidden
                            className="size-5 shrink-0 text-muted-foreground"
                        />
                    )}
                    <div className="grid min-w-0 flex-1">
                        <h1 className="flex items-center gap-2 truncate font-semibold">
                            {label}
                            {membership?.is_muted && (
                                <BellOff
                                    aria-label="Muted"
                                    className="size-3.5 text-muted-foreground"
                                />
                            )}
                        </h1>
                        {directMember ? (
                            <StatusLabel userId={directMember.id} />
                        ) : (
                            conversation.description && (
                                <p className="truncate text-xs text-muted-foreground">
                                    {conversation.description}
                                </p>
                            )
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetails('pinned')}
                            aria-label={`Pinned messages: ${pinned.length}`}
                        >
                            <Pin />{' '}
                            <span className="tabular-nums">
                                {pinned.length}
                            </span>
                        </Button>
                        {conversation.type !== 'direct' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDetails('members')}
                                aria-label={`Members: ${members.length}`}
                            >
                                <Users />{' '}
                                <span className="tabular-nums">
                                    {members.length}
                                </span>
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetails('about')}
                            aria-label="Conversation details"
                        >
                            <Info />
                        </Button>
                    </div>
                </div>

                <div className="relative min-h-0 flex-1">
                    <div
                        ref={scroller}
                        onScroll={onScroll}
                        className="h-full overflow-y-auto pb-4"
                        role="log"
                        aria-label={`Messages in ${label}`}
                        aria-live="polite"
                        aria-relevant="additions"
                    >
                        <div ref={topSentinel} />
                        {cursor ? (
                            <div className="flex justify-center py-4">
                                {olderFailed ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void loadOlder()}
                                    >
                                        Couldn’t load older messages. Retry
                                    </Button>
                                ) : (
                                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                        {loadingOlder ? <Spinner /> : null}{' '}
                                        Loading older messages…
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="px-4 pt-10 pb-4">
                                <p className="text-2xl font-semibold">
                                    {conversation.type === 'direct'
                                        ? conversation.name
                                        : label}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {conversation.type === 'direct'
                                        ? `This is the beginning of your direct message history with ${conversation.name}.`
                                        : `This is the very beginning of ${label}.`}
                                    {conversation.description
                                        ? ` ${conversation.description}`
                                        : ''}
                                </p>
                            </div>
                        )}

                        {messages.length === 0 && !cursor && (
                            <p className="px-4 text-sm text-muted-foreground">
                                No messages yet. Say hello! 👋
                            </p>
                        )}

                        {messages.map((message, index) => {
                            const previous = messages[index - 1];
                            const newDay =
                                !previous ||
                                formatDay(previous.created_at) !==
                                    formatDay(message.created_at);
                            const isUnreadStart =
                                message.id === unreadMarkerId.current;

                            return (
                                <Fragment key={message.client_id ?? message.id}>
                                    {newDay && (
                                        <div
                                            className="sticky top-0 z-[5] my-2 flex justify-center"
                                            role="separator"
                                            aria-label={formatDay(
                                                message.created_at,
                                            )}
                                        >
                                            <span className="rounded-full border bg-background px-3 py-0.5 text-xs font-medium shadow-xs">
                                                {formatDay(message.created_at)}
                                            </span>
                                        </div>
                                    )}
                                    {isUnreadStart && (
                                        <div
                                            className="my-2 flex items-center gap-2 px-4"
                                            role="separator"
                                            aria-label="New messages"
                                        >
                                            <span className="h-px flex-1 bg-destructive/60" />
                                            <span className="text-xs font-semibold text-destructive">
                                                New
                                            </span>
                                        </div>
                                    )}
                                    <MessageItem
                                        message={message}
                                        continuation={
                                            !newDay &&
                                            !isUnreadStart &&
                                            isContinuation(message, previous)
                                        }
                                        readers={readersByMessage[message.id]}
                                        highlighted={
                                            highlightedId === message.id
                                        }
                                    />
                                </Fragment>
                            );
                        })}
                    </div>

                    {showJump && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={jumpToLatest}
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md"
                        >
                            <ArrowDown /> Jump to latest
                        </Button>
                    )}
                </div>

                <div className="shrink-0 px-4 pb-3">
                    <TypingIndicator names={typingNames(null)} />
                    {can.post ? (
                        <Composer
                            label={`Message ${label}`}
                            placeholder={`Message ${label}`}
                            members={members}
                            currentUserId={currentUser.id}
                            onSend={(body, files) => send(body, files, null)}
                            onTyping={() => sendTyping(null)}
                            autoFocus
                        />
                    ) : can.join ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 p-4 text-center sm:flex-row sm:text-left">
                            <p className="flex-1 text-sm">
                                You’re previewing <strong>{label}</strong>. Join
                                to post, react, and get live updates.
                            </p>
                            <Button
                                onClick={() =>
                                    router.post(
                                        ConversationMembershipController.store.url(
                                            conversation.id,
                                        ),
                                    )
                                }
                            >
                                Join channel
                            </Button>
                        </div>
                    ) : (
                        <p className="rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                            {conversation.is_read_only
                                ? 'This channel is read-only. Only owners and admins can post.'
                                : 'You can’t post in this conversation.'}
                        </p>
                    )}
                </div>
            </div>

            {membership && (
                <ThreadPanel
                    thread={thread}
                    conversationLabel={label}
                    canPost={can.post}
                    members={members}
                    currentUserId={currentUser.id}
                    onClose={() => setThread(null)}
                    onSend={(body, files) =>
                        thread && send(body, files, thread.parent.id)
                    }
                    onTyping={() => thread && sendTyping(thread.parent.id)}
                />
            )}

            <ConversationDetails
                open={detailsOpen}
                tab={detailsTab}
                onTabChange={setDetailsTab}
                onOpenChange={setDetailsOpen}
                conversation={conversation}
                pinned={pinned}
                reports={reports}
                onJump={jumpToMessage}
            />
        </ChatContext.Provider>
    );
}
