import { Form, Head, Link, router } from '@inertiajs/react';
import { Check, Hash, Lock, Search } from 'lucide-react';
import ConversationMembershipController from '@/actions/App/Http/Controllers/Chat/ConversationMembershipController';
import { NewConversationDialog } from '@/components/chat/new-conversation-dialog';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { index as channelsIndex } from '@/routes/channels';
import { show } from '@/routes/conversations';

type Channel = {
    id: number;
    name: string;
    description: string | null;
    is_read_only: boolean;
    member_count: number;
    is_member: boolean;
};

export default function ChannelsIndex({
    channels,
    search,
}: {
    channels: Channel[];
    search: string;
}) {
    return (
        <>
            <Head title="Browse channels" />
            <div className="mx-auto grid w-full max-w-3xl gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <Heading
                        title="Browse channels"
                        description="Public channels anyone in the workspace can join."
                    />
                    <NewConversationDialog
                        kind="channel"
                        trigger={<Button>Create channel</Button>}
                    />
                </div>

                <Form
                    {...channelsIndex.form()}
                    options={{ preserveState: true, replace: true }}
                    role="search"
                >
                    <label htmlFor="channel-search" className="sr-only">
                        Search channels
                    </label>
                    <div className="relative">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            id="channel-search"
                            type="search"
                            name="search"
                            defaultValue={search}
                            placeholder="Search channels by name…"
                            autoComplete="off"
                            className="h-11 pl-9 text-base md:text-sm"
                        />
                    </div>
                </Form>

                {channels.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center">
                        <p className="font-medium">
                            {search
                                ? `No channels match “${search}”.`
                                : 'No public channels yet.'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Create one to get the conversation started.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y rounded-xl border">
                        {channels.map((channel) => (
                            <li
                                key={channel.id}
                                className="flex flex-wrap items-center gap-3 px-4 py-3"
                            >
                                <Hash
                                    aria-hidden
                                    className="size-5 shrink-0 text-muted-foreground"
                                />
                                <div className="grid min-w-0 flex-1">
                                    <Link
                                        href={show(channel.id)}
                                        className="truncate font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                                    >
                                        {channel.name}
                                    </Link>
                                    <p className="truncate text-sm text-muted-foreground">
                                        <span className="tabular-nums">
                                            {channel.member_count}{' '}
                                            {channel.member_count === 1
                                                ? 'member'
                                                : 'members'}
                                        </span>
                                        {channel.is_read_only && (
                                            <>
                                                {' · '}
                                                <Lock
                                                    aria-hidden
                                                    className="inline size-3"
                                                />{' '}
                                                Read-only
                                            </>
                                        )}
                                        {channel.description
                                            ? ` · ${channel.description}`
                                            : ''}
                                    </p>
                                </div>
                                {channel.is_member ? (
                                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                                        <Check aria-hidden className="size-4" />{' '}
                                        Joined
                                    </span>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            router.post(
                                                ConversationMembershipController.store.url(
                                                    channel.id,
                                                ),
                                            )
                                        }
                                    >
                                        Join
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

ChannelsIndex.layout = {
    breadcrumbs: [{ title: 'Browse channels', href: channelsIndex() }],
};
