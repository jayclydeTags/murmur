import { router, useForm } from '@inertiajs/react';
import {
    Archive,
    ArchiveRestore,
    Bell,
    BellOff,
    LogOut,
    MoreHorizontal,
    PinOff,
    ShieldCheck,
    Trash2,
    UserMinus,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import ConversationController from '@/actions/App/Http/Controllers/Chat/ConversationController';
import ConversationMemberController from '@/actions/App/Http/Controllers/Chat/ConversationMemberController';
import ConversationMembershipController from '@/actions/App/Http/Controllers/Chat/ConversationMembershipController';
import ConversationPreferenceController from '@/actions/App/Http/Controllers/Chat/ConversationPreferenceController';
import MessageController from '@/actions/App/Http/Controllers/Chat/MessageController';
import MessageReportController from '@/actions/App/Http/Controllers/Chat/MessageReportController';
import InputError from '@/components/input-error';
import { useChat } from '@/components/chat/chat-context';
import { PeoplePicker } from '@/components/chat/people-picker';
import { StatusLabel, UserAvatar } from '@/components/chat/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { conversationLabel, formatFullDate } from '@/lib/chat';
import { errorMessage, request } from '@/lib/http';
import { cn } from '@/lib/utils';
import type {
    ChatMessage,
    Conversation,
    ConversationMemberSummary,
    MessageReport,
    UserSummary,
} from '@/types';

export type DetailsTab = 'about' | 'members' | 'pinned' | 'reports';

function AboutTab({ conversation }: { conversation: Conversation }) {
    const { can, membership } = useChat();
    const form = useForm<{
        name: string;
        description: string;
        is_read_only: boolean;
        avatar: File | null;
    }>({
        name: conversation.name,
        description: conversation.description ?? '',
        is_read_only: conversation.is_read_only,
        avatar: null,
    });

    const save = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, _method: 'patch' }));
        form.post(ConversationController.update.url(conversation.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.setData('avatar', null),
        });
    };

    const setPreference = (data: { muted?: boolean; archived?: boolean }) => {
        router.patch(
            ConversationPreferenceController.update.url(conversation.id),
            data,
            {
                preserveScroll: true,
                only: ['membership', 'sidebar', 'flash'],
            },
        );
    };

    return (
        <div className="grid gap-6">
            {can.update ? (
                <form onSubmit={save} className="grid gap-4" noValidate>
                    <div className="grid gap-2">
                        <Label htmlFor="conversation-name">Name</Label>
                        <Input
                            id="conversation-name"
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            maxLength={80}
                            required
                            autoComplete="off"
                            className="text-base md:text-sm"
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="conversation-description">
                            Description
                        </Label>
                        <Input
                            id="conversation-description"
                            value={form.data.description}
                            onChange={(event) =>
                                form.setData('description', event.target.value)
                            }
                            maxLength={500}
                            autoComplete="off"
                            className="text-base md:text-sm"
                        />
                        <InputError message={form.errors.description} />
                    </div>
                    {conversation.type === 'group' && (
                        <div className="grid gap-2">
                            <Label htmlFor="conversation-avatar">
                                Group avatar
                            </Label>
                            <Input
                                id="conversation-avatar"
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                onChange={(event) =>
                                    form.setData(
                                        'avatar',
                                        event.target.files?.[0] ?? null,
                                    )
                                }
                            />
                            <InputError message={form.errors.avatar} />
                        </div>
                    )}
                    {conversation.type === 'channel' && (
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="conversation-read-only"
                                checked={form.data.is_read_only}
                                onCheckedChange={(checked) =>
                                    form.setData(
                                        'is_read_only',
                                        checked === true,
                                    )
                                }
                            />
                            <div className="grid gap-1">
                                <Label htmlFor="conversation-read-only">
                                    Read-only
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Only owners and admins can post. Members can
                                    still read and react.
                                </p>
                            </div>
                        </div>
                    )}
                    <div>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />} Save changes
                        </Button>
                    </div>
                </form>
            ) : (
                <dl className="grid gap-3 text-sm">
                    <div>
                        <dt className="font-medium">Name</dt>
                        <dd className="text-muted-foreground">
                            {conversationLabel(conversation)}
                        </dd>
                    </div>
                    {conversation.description && (
                        <div>
                            <dt className="font-medium">Description</dt>
                            <dd className="text-muted-foreground">
                                {conversation.description}
                            </dd>
                        </div>
                    )}
                    {conversation.is_read_only && (
                        <div>
                            <dt className="font-medium">Posting</dt>
                            <dd className="text-muted-foreground">
                                Only owners and admins can post.
                            </dd>
                        </div>
                    )}
                </dl>
            )}

            {membership && (
                <section
                    className="grid gap-2 border-t pt-4"
                    aria-labelledby="preferences-heading"
                >
                    <h3
                        id="preferences-heading"
                        className="text-sm font-medium"
                    >
                        Your preferences
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setPreference({ muted: !membership.is_muted })
                            }
                        >
                            {membership.is_muted ? <Bell /> : <BellOff />}
                            {membership.is_muted ? 'Unmute' : 'Mute'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setPreference({
                                    archived: !membership.is_archived,
                                })
                            }
                        >
                            {membership.is_archived ? (
                                <ArchiveRestore />
                            ) : (
                                <Archive />
                            )}
                            {membership.is_archived
                                ? 'Restore from archive'
                                : 'Archive'}
                        </Button>
                        {can.leave && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                    router.delete(
                                        ConversationMembershipController.destroy.url(
                                            conversation.id,
                                        ),
                                    )
                                }
                            >
                                <LogOut /> Leave
                            </Button>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Muted conversations don’t send toasts or browser
                        notifications, but @mentions still reach you.
                    </p>
                </section>
            )}
        </div>
    );
}

const roleLabels = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
} as const;

function MembersTab({ conversation }: { conversation: Conversation }) {
    const { members, can, currentUser, membership } = useChat();
    const [adding, setAdding] = useState<UserSummary[]>([]);
    const [processing, setProcessing] = useState(false);
    const myRole = membership?.role;

    const canRemove = (member: ConversationMemberSummary) =>
        can.moderate &&
        member.id !== currentUser.id &&
        (myRole === 'owner'
            ? member.role !== 'owner'
            : member.role === 'member');

    const addPeople = () => {
        router.post(
            ConversationMemberController.store.url(conversation.id),
            { user_ids: adding.map((person) => person.id) },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => setAdding([]),
            },
        );
    };

    return (
        <div className="grid gap-6">
            {can.addMembers && (
                <section className="grid gap-3" aria-label="Add people">
                    <PeoplePicker
                        label="Add people"
                        selected={adding}
                        onChange={setAdding}
                        excludeIds={members.map((member) => member.id)}
                    />
                    <div>
                        <Button
                            onClick={addPeople}
                            disabled={adding.length === 0 || processing}
                        >
                            {processing && <Spinner />} Add{' '}
                            {adding.length > 0 ? adding.length : ''}{' '}
                            {adding.length === 1 ? 'person' : 'people'}
                        </Button>
                    </div>
                </section>
            )}

            <ul className="grid gap-1" aria-label="Members">
                {members.map((member) => (
                    <li
                        key={member.id}
                        className="flex min-h-12 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                        <UserAvatar user={member} showPresence />
                        <div className="grid min-w-0 flex-1">
                            <span className="truncate text-sm font-medium">
                                {member.name}
                                {member.id === currentUser.id && (
                                    <span className="font-normal text-muted-foreground">
                                        {' '}
                                        (you)
                                    </span>
                                )}
                            </span>
                            <StatusLabel userId={member.id} />
                        </div>
                        {conversation.type !== 'direct' &&
                            member.role !== 'member' && (
                                <Badge variant="secondary">
                                    {roleLabels[member.role]}
                                </Badge>
                            )}
                        {(can.changeRoles && member.id !== currentUser.id) ||
                        canRemove(member) ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8"
                                        aria-label={`Manage ${member.name}`}
                                    >
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {can.changeRoles &&
                                        member.id !== currentUser.id &&
                                        (['owner', 'admin', 'member'] as const)
                                            .filter(
                                                (role) => role !== member.role,
                                            )
                                            .map((role) => (
                                                <DropdownMenuItem
                                                    key={role}
                                                    onSelect={() =>
                                                        router.patch(
                                                            ConversationMemberController.update.url(
                                                                {
                                                                    conversation:
                                                                        conversation.id,
                                                                    user: member.id,
                                                                },
                                                            ),
                                                            { role },
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        )
                                                    }
                                                >
                                                    <ShieldCheck /> Make{' '}
                                                    {roleLabels[
                                                        role
                                                    ].toLowerCase()}
                                                </DropdownMenuItem>
                                            ))}
                                    {canRemove(member) && (
                                        <>
                                            {can.changeRoles && (
                                                <DropdownMenuSeparator />
                                            )}
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onSelect={() =>
                                                    router.delete(
                                                        ConversationMemberController.destroy.url(
                                                            {
                                                                conversation:
                                                                    conversation.id,
                                                                user: member.id,
                                                            },
                                                        ),
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                            >
                                                <UserMinus /> Remove from
                                                conversation
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function PinnedTab({
    pinned,
    onJump,
}: {
    pinned: ChatMessage[];
    onJump: (message: ChatMessage) => void;
}) {
    const { actions } = useChat();

    if (pinned.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Nothing pinned yet. Pin important messages from their “More
                actions” menu.
            </p>
        );
    }

    return (
        <ul className="grid gap-2" aria-label="Pinned messages">
            {pinned.map((message) => (
                <li key={message.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                        {message.user && (
                            <UserAvatar
                                user={message.user}
                                className="size-6"
                            />
                        )}
                        <span className="text-sm font-medium">
                            {message.user?.name}
                        </span>
                        <time
                            dateTime={message.created_at}
                            className="text-xs text-muted-foreground"
                        >
                            {formatFullDate(message.created_at)}
                        </time>
                    </div>
                    <p className="mt-1.5 line-clamp-4 text-sm whitespace-pre-wrap">
                        {message.body ??
                            `${message.attachments.length} attachment(s)`}
                    </p>
                    <div className="mt-2 flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onJump(message)}
                        >
                            Jump to message
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => actions.togglePin(message)}
                        >
                            <PinOff /> Unpin
                        </Button>
                    </div>
                </li>
            ))}
        </ul>
    );
}

function ReportsTab({ reports }: { reports: MessageReport[] }) {
    const [deletingId, setDeletingId] = useState<number | null>(null);

    if (reports.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No open reports. Nice and quiet.
            </p>
        );
    }

    const deleteMessage = async (report: MessageReport) => {
        setDeletingId(report.id);

        try {
            await request(MessageController.destroy(report.message.id));
            toast.success('Message deleted.');
            router.reload({ only: ['reports'] });
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <ul className="grid gap-3" aria-label="Open reports">
            {reports.map((report) => (
                <li key={report.id} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                        Reported by {report.reporter.name} ·{' '}
                        {formatFullDate(report.created_at)}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                        “{report.reason}”
                    </p>
                    <blockquote className="mt-2 border-l-2 pl-3 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                            {report.message.user?.name}:
                        </span>{' '}
                        {report.message.is_deleted ? (
                            <em>Message already deleted</em>
                        ) : (
                            report.message.body
                        )}
                    </blockquote>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                router.patch(
                                    MessageReportController.update.url(
                                        report.id,
                                    ),
                                    {},
                                    {
                                        preserveScroll: true,
                                        only: ['reports', 'flash'],
                                    },
                                )
                            }
                        >
                            Dismiss
                        </Button>
                        {!report.message.is_deleted && (
                            <Button
                                size="sm"
                                variant="destructive"
                                disabled={deletingId === report.id}
                                onClick={() => void deleteMessage(report)}
                            >
                                {deletingId === report.id ? (
                                    <Spinner />
                                ) : (
                                    <Trash2 />
                                )}{' '}
                                Delete message
                            </Button>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
}

export function ConversationDetails({
    open,
    tab,
    onTabChange,
    onOpenChange,
    conversation,
    pinned,
    reports,
    onJump,
}: {
    open: boolean;
    tab: DetailsTab;
    onTabChange: (tab: DetailsTab) => void;
    onOpenChange: (open: boolean) => void;
    conversation: Conversation;
    pinned: ChatMessage[];
    reports: MessageReport[];
    onJump: (message: ChatMessage) => void;
}) {
    const { members, can } = useChat();

    const tabs: { id: DetailsTab; label: string; count?: number }[] = [
        { id: 'about', label: 'About' },
        { id: 'members', label: 'Members', count: members.length },
        { id: 'pinned', label: 'Pinned', count: pinned.length },
        ...(can.moderate
            ? [
                  {
                      id: 'reports' as const,
                      label: 'Reports',
                      count: reports.length,
                  },
              ]
            : []),
    ];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
            >
                <SheetHeader className="border-b">
                    <SheetTitle>{conversationLabel(conversation)}</SheetTitle>
                    <SheetDescription>
                        {conversation.type === 'direct'
                            ? 'Direct message'
                            : conversation.type === 'group'
                              ? 'Group chat'
                              : conversation.is_private
                                ? 'Private channel'
                                : 'Public channel'}
                    </SheetDescription>
                    <div
                        role="tablist"
                        aria-label="Conversation details"
                        className="-mb-px flex gap-1 overflow-x-auto pt-2"
                    >
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                id={`details-tab-${item.id}`}
                                aria-selected={tab === item.id}
                                aria-controls={`details-panel-${item.id}`}
                                onClick={() => onTabChange(item.id)}
                                className={cn(
                                    'min-h-10 shrink-0 border-b-2 px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                    tab === item.id
                                        ? 'border-primary text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {item.label}
                                {item.count !== undefined && (
                                    <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                                        {item.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </SheetHeader>
                <div
                    role="tabpanel"
                    id={`details-panel-${tab}`}
                    aria-labelledby={`details-tab-${tab}`}
                    className="min-h-0 flex-1 overflow-y-auto p-4"
                >
                    {tab === 'about' && (
                        <AboutTab
                            key={conversation.id}
                            conversation={conversation}
                        />
                    )}
                    {tab === 'members' && (
                        <MembersTab conversation={conversation} />
                    )}
                    {tab === 'pinned' && (
                        <PinnedTab pinned={pinned} onJump={onJump} />
                    )}
                    {tab === 'reports' && <ReportsTab reports={reports} />}
                </div>
            </SheetContent>
        </Sheet>
    );
}
