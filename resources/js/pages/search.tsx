import { Form, Head, Link } from '@inertiajs/react';
import {
    Hash,
    Lock,
    MessageSquareText,
    Search as SearchIcon,
    Users,
} from 'lucide-react';
import { UserAvatar } from '@/components/chat/user-avatar';
import Heading from '@/components/heading';
import { Input } from '@/components/ui/input';
import { formatFullDate } from '@/lib/chat';
import { search as searchRoute } from '@/routes';
import { show } from '@/routes/conversations';
import type { Conversation, ConversationType, UserSummary } from '@/types';

type MessageResult = {
    id: number;
    parent_id: number | null;
    body: string;
    user: UserSummary | null;
    created_at: string;
    conversation: { id: number; type: ConversationType; name: string };
};

function Highlight({ text, query }: { text: string; query: string }) {
    const index = text.toLowerCase().indexOf(query.toLowerCase());

    if (query === '' || index === -1) {
        return <>{text}</>;
    }

    return (
        <>
            {text.slice(0, index)}
            <mark className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">
                {text.slice(index, index + query.length)}
            </mark>
            {text.slice(index + query.length)}
        </>
    );
}

export default function Search({
    query,
    messages,
    conversations,
}: {
    query: string;
    messages: MessageResult[];
    conversations: Conversation[];
}) {
    const hasQuery = query.length >= 2;

    return (
        <>
            <Head title={hasQuery ? `Search: ${query}` : 'Search'} />
            <div className="mx-auto grid w-full max-w-3xl gap-6 p-4 md:p-6">
                <Heading
                    title="Search"
                    description="Find messages and conversations you have access to."
                />

                <Form
                    {...searchRoute.form()}
                    options={{ preserveState: true, replace: true }}
                    role="search"
                >
                    <label htmlFor="search-input" className="sr-only">
                        Search messages and conversations
                    </label>
                    <div className="relative">
                        <SearchIcon
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            id="search-input"
                            type="search"
                            name="q"
                            defaultValue={query}
                            placeholder="Search for a word, a person, or a channel…"
                            autoComplete="off"
                            autoFocus
                            minLength={2}
                            className="h-11 pl-9 text-base md:text-sm"
                        />
                    </div>
                </Form>

                {!hasQuery ? (
                    <p className="text-sm text-muted-foreground">
                        Type at least two characters and press Enter.
                    </p>
                ) : (
                    <>
                        <section aria-labelledby="conversation-results">
                            <h2
                                id="conversation-results"
                                className="mb-2 text-sm font-semibold"
                            >
                                Conversations{' '}
                                <span className="font-normal text-muted-foreground tabular-nums">
                                    ({conversations.length})
                                </span>
                            </h2>
                            {conversations.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No conversations match.
                                </p>
                            ) : (
                                <ul className="divide-y rounded-xl border">
                                    {conversations.map((conversation) => {
                                        const Icon =
                                            conversation.type === 'group'
                                                ? Users
                                                : conversation.is_private
                                                  ? Lock
                                                  : Hash;

                                        return (
                                            <li key={conversation.id}>
                                                <Link
                                                    href={show(conversation.id)}
                                                    className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
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
                                                    ) : (
                                                        <Icon
                                                            aria-hidden
                                                            className="size-4 text-muted-foreground"
                                                        />
                                                    )}
                                                    <span className="text-sm font-medium">
                                                        <Highlight
                                                            text={
                                                                conversation.name
                                                            }
                                                            query={query}
                                                        />
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>

                        <section aria-labelledby="message-results">
                            <h2
                                id="message-results"
                                className="mb-2 text-sm font-semibold"
                            >
                                Messages{' '}
                                <span className="font-normal text-muted-foreground tabular-nums">
                                    ({messages.length})
                                </span>
                            </h2>
                            {messages.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No messages match “{query}”.
                                </p>
                            ) : (
                                <ul className="divide-y rounded-xl border">
                                    {messages.map((message) => (
                                        <li key={message.id}>
                                            <Link
                                                href={show(
                                                    message.conversation.id,
                                                )}
                                                className="flex gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                                            >
                                                {message.user && (
                                                    <UserAvatar
                                                        user={message.user}
                                                    />
                                                )}
                                                <span className="grid min-w-0 flex-1 gap-0.5">
                                                    <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
                                                        <strong>
                                                            {message.user
                                                                ?.name ??
                                                                'Deleted user'}
                                                        </strong>
                                                        <span className="text-muted-foreground">
                                                            in{' '}
                                                            {message
                                                                .conversation
                                                                .type ===
                                                            'channel'
                                                                ? `#${message.conversation.name}`
                                                                : message
                                                                      .conversation
                                                                      .name}
                                                        </span>
                                                        {message.parent_id && (
                                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                                <MessageSquareText
                                                                    aria-hidden
                                                                    className="size-3"
                                                                />{' '}
                                                                thread reply
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="line-clamp-3 text-sm whitespace-pre-wrap">
                                                        <Highlight
                                                            text={message.body}
                                                            query={query}
                                                        />
                                                    </span>
                                                    <time
                                                        dateTime={
                                                            message.created_at
                                                        }
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        {formatFullDate(
                                                            message.created_at,
                                                        )}
                                                    </time>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </div>
        </>
    );
}

Search.layout = {
    breadcrumbs: [{ title: 'Search', href: searchRoute() }],
};
