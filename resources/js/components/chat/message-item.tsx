import {
    AlertCircle,
    Copy,
    Flag,
    MessageSquareText,
    MoreHorizontal,
    Pencil,
    Pin,
    PinOff,
    SmilePlus,
    Trash2,
} from 'lucide-react';
import { memo, useId, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { useChat } from '@/components/chat/chat-context';
import {
    LinkPreviewCard,
    MessageAttachments,
} from '@/components/chat/message-attachments';
import { MessageBody } from '@/components/chat/message-body';
import { UserAvatar } from '@/components/chat/user-avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { REACTION_EMOJIS, formatFullDate, formatTime } from '@/lib/chat';
import { errorMessage } from '@/lib/http';
import { cn } from '@/lib/utils';
import type { ChatMessage, UserSummary } from '@/types';

const textareaClass =
    'w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none field-sizing-content focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm';

function ToolbarButton({
    label,
    ...props
}: { label: string } & React.ComponentProps<typeof Button>) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={label}
                    {...props}
                />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function ReactionPicker({
    onPick,
    label = 'Add reaction',
}: {
    onPick: (emoji: string) => void;
    label?: string;
}) {
    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={label}
                        >
                            <SmilePlus />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
                align="end"
                className="grid grid-cols-4 gap-1 p-1.5"
            >
                {REACTION_EMOJIS.map((emoji) => (
                    <DropdownMenuItem
                        key={emoji}
                        onSelect={() => onPick(emoji)}
                        className="justify-center text-lg"
                        aria-label={`React with ${emoji}`}
                    >
                        {emoji}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export const MessageItem = memo(function MessageItem({
    message,
    continuation,
    readers = [],
    inThread = false,
    highlighted = false,
}: {
    message: ChatMessage;
    continuation: boolean;
    readers?: UserSummary[];
    inThread?: boolean;
    highlighted?: boolean;
}) {
    const { currentUser, members, membership, can, actions } = useChat();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(message.body ?? '');
    const [saving, setSaving] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportError, setReportError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const editId = useId();
    const reportId = useId();

    const isOwn = message.user?.id === currentUser.id;
    const isPending = message.status !== undefined;
    const isMember = membership !== null;
    const canDelete = isOwn || can.moderate;
    const memberNames = members.map((member) => member.name);
    const author = message.user ?? {
        id: 0,
        name: 'Deleted user',
        avatar: null,
    };

    const startEditing = () => {
        setDraft(message.body ?? '');
        setIsEditing(true);
    };

    const saveEdit = async (event?: FormEvent) => {
        event?.preventDefault();

        if (draft.trim() === '') {
            return;
        }

        setSaving(true);

        try {
            await actions.edit(message, draft.trim());
            setIsEditing(false);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const onEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Escape') {
            setIsEditing(false);
        }

        if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
        ) {
            event.preventDefault();
            void saveEdit();
        }
    };

    const confirmDelete = async () => {
        setBusy(true);

        try {
            await actions.remove(message);
            setConfirmingDelete(false);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const submitReport = async (event: FormEvent) => {
        event.preventDefault();

        if (reportReason.trim() === '') {
            setReportError('Tell the admins what’s wrong with this message.');
            document.getElementById(reportId)?.focus();

            return;
        }

        setBusy(true);

        try {
            await actions.report(message, reportReason.trim());
            setReporting(false);
            setReportReason('');
            setReportError(null);
        } catch (error) {
            setReportError(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <article
            id={`message-${message.id}`}
            aria-label={`${author.name}, ${formatFullDate(message.created_at)}`}
            className={cn(
                'group relative flex gap-3 px-4 py-0.5 focus-within:bg-muted/40 hover:bg-muted/40',
                !continuation && 'mt-3 pt-1',
                isPending && message.status === 'sending' && 'opacity-60',
                highlighted && 'bg-amber-100/60 dark:bg-amber-400/10',
                message.is_pinned &&
                    !inThread &&
                    'bg-amber-50/50 dark:bg-amber-400/5',
            )}
        >
            <div className="w-9 shrink-0">
                {continuation ? (
                    <time
                        dateTime={message.created_at}
                        className="invisible block pt-1 text-right text-[0.65rem] text-muted-foreground tabular-nums group-focus-within:visible group-hover:visible"
                    >
                        {formatTime(message.created_at)}
                    </time>
                ) : (
                    <UserAvatar user={author} className="size-9" />
                )}
            </div>

            <div className="min-w-0 flex-1">
                {!continuation && (
                    <header className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold">
                            {author.name}
                        </span>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <time
                                    dateTime={message.created_at}
                                    className="text-xs text-muted-foreground tabular-nums"
                                >
                                    {formatTime(message.created_at)}
                                </time>
                            </TooltipTrigger>
                            <TooltipContent>
                                {formatFullDate(message.created_at)}
                            </TooltipContent>
                        </Tooltip>
                        {message.is_pinned && !inThread && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                                <Pin aria-hidden className="size-3" /> Pinned
                            </span>
                        )}
                    </header>
                )}

                {isEditing ? (
                    <form onSubmit={saveEdit} className="mt-1 grid gap-2">
                        <label htmlFor={editId} className="sr-only">
                            Edit message
                        </label>
                        <textarea
                            id={editId}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={onEditKeyDown}
                            className={cn(textareaClass, 'max-h-60')}
                            autoFocus
                            maxLength={5000}
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Button type="submit" size="sm" disabled={saving}>
                                {saving && <Spinner />} Save
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsEditing(false)}
                            >
                                Cancel
                            </Button>
                            <span className="hidden sm:inline">
                                Enter to save · Esc to cancel
                            </span>
                        </div>
                    </form>
                ) : (
                    message.body && (
                        <MessageBody
                            body={message.body}
                            memberNames={memberNames}
                            currentUserName={currentUser.name}
                        />
                    )
                )}

                {message.is_edited && !isEditing && (
                    <span className="text-xs text-muted-foreground">
                        (edited)
                    </span>
                )}

                <MessageAttachments attachments={message.attachments} />

                {message.link_preview && (
                    <LinkPreviewCard preview={message.link_preview} />
                )}

                {message.status === 'failed' && (
                    <p
                        className="mt-1 flex flex-wrap items-center gap-2 text-xs text-destructive"
                        role="alert"
                    >
                        <AlertCircle aria-hidden className="size-3.5" />
                        Couldn’t send this message.
                        <button
                            type="button"
                            className="font-medium underline"
                            onClick={() => actions.retry(message)}
                        >
                            Retry
                        </button>
                        <button
                            type="button"
                            className="font-medium underline"
                            onClick={() => actions.discard(message)}
                        >
                            Discard
                        </button>
                    </p>
                )}

                {message.reactions.length > 0 && (
                    <ul
                        className="mt-1.5 flex flex-wrap gap-1"
                        aria-label="Reactions"
                    >
                        {message.reactions.map((reaction) => {
                            const reacted = reaction.user_ids.includes(
                                currentUser.id,
                            );
                            const names = reaction.user_ids
                                .map((id) =>
                                    id === currentUser.id
                                        ? 'You'
                                        : members.find(
                                              (member) => member.id === id,
                                          )?.name,
                                )
                                .filter(Boolean)
                                .join(', ');

                            return (
                                <li key={reaction.emoji}>
                                    <button
                                        type="button"
                                        disabled={!isMember || isPending}
                                        onClick={() =>
                                            actions.toggleReaction(
                                                message,
                                                reaction.emoji,
                                            )
                                        }
                                        aria-pressed={reacted}
                                        aria-label={`${reaction.emoji} ${reaction.count}: ${names}`}
                                        title={names}
                                        className={cn(
                                            'inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-xs tabular-nums hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default',
                                            reacted
                                                ? 'border-primary/50 bg-primary/10 font-medium'
                                                : 'bg-background',
                                        )}
                                    >
                                        <span aria-hidden>
                                            {reaction.emoji}
                                        </span>
                                        <span aria-hidden>
                                            {reaction.count}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {!inThread && message.reply_count > 0 && (
                    <button
                        type="button"
                        onClick={() => actions.openThread(message)}
                        className="mt-1 inline-flex min-h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <MessageSquareText aria-hidden className="size-3.5" />
                        {message.reply_count === 1
                            ? '1 reply'
                            : `${message.reply_count} replies`}
                        {message.latest_reply_at && (
                            <span className="font-normal text-muted-foreground">
                                · last {formatTime(message.latest_reply_at)}
                            </span>
                        )}
                    </button>
                )}

                {readers.length > 0 && (
                    <div
                        className="mt-1 flex items-center justify-end gap-1"
                        aria-label={`Seen by ${readers.map((reader) => reader.name).join(', ')}`}
                    >
                        <span
                            aria-hidden
                            className="mr-1 text-[0.65rem] text-muted-foreground"
                        >
                            Seen
                        </span>
                        {readers.slice(0, 5).map((reader) => (
                            <UserAvatar
                                key={reader.id}
                                user={reader}
                                className="size-4 rounded-full text-[0.5rem]"
                            />
                        ))}
                        {readers.length > 5 && (
                            <span
                                aria-hidden
                                className="text-[0.65rem] text-muted-foreground tabular-nums"
                            >
                                +{readers.length - 5}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {isMember && !isPending && !isEditing && (
                <div
                    role="toolbar"
                    aria-label="Message actions"
                    className="absolute -top-3 right-4 z-10 flex items-center rounded-lg border bg-popover p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100"
                >
                    <ReactionPicker
                        onPick={(emoji) =>
                            actions.toggleReaction(message, emoji)
                        }
                    />
                    {!inThread && (
                        <ToolbarButton
                            label="Reply in thread"
                            onClick={() => actions.openThread(message)}
                        >
                            <MessageSquareText />
                        </ToolbarButton>
                    )}
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8"
                                        aria-label="More actions"
                                    >
                                        <MoreHorizontal />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>More actions</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                            {isOwn && (
                                <DropdownMenuItem onSelect={startEditing}>
                                    <Pencil /> Edit message
                                </DropdownMenuItem>
                            )}
                            {!inThread && (
                                <DropdownMenuItem
                                    onSelect={() => actions.togglePin(message)}
                                >
                                    {message.is_pinned ? <PinOff /> : <Pin />}
                                    {message.is_pinned
                                        ? 'Unpin'
                                        : 'Pin to conversation'}
                                </DropdownMenuItem>
                            )}
                            {message.body && (
                                <DropdownMenuItem
                                    onSelect={() => {
                                        void navigator.clipboard
                                            .writeText(message.body ?? '')
                                            .then(() =>
                                                toast.success(
                                                    'Copied to clipboard.',
                                                ),
                                            );
                                    }}
                                >
                                    <Copy /> Copy text
                                </DropdownMenuItem>
                            )}
                            {!isOwn && (
                                <DropdownMenuItem
                                    onSelect={() => setReporting(true)}
                                >
                                    <Flag /> Report message
                                </DropdownMenuItem>
                            )}
                            {canDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() =>
                                            setConfirmingDelete(true)
                                        }
                                    >
                                        <Trash2 />{' '}
                                        {isOwn
                                            ? 'Delete message'
                                            : 'Delete as admin'}
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
                <DialogContent className="sm:max-w-md">
                    <DialogTitle>Delete this message?</DialogTitle>
                    <DialogDescription>
                        {isOwn
                            ? 'It will be removed for everyone in the conversation.'
                            : `You’re deleting ${author.name}’s message as an admin. It will be removed for everyone.`}
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setConfirmingDelete(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => void confirmDelete()}
                            disabled={busy}
                        >
                            {busy && <Spinner />} Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={reporting} onOpenChange={setReporting}>
                <DialogContent className="sm:max-w-md">
                    <DialogTitle>Report message</DialogTitle>
                    <DialogDescription>
                        The conversation’s owners and admins will review it.{' '}
                        {author.name} won’t see who reported it.
                    </DialogDescription>
                    <form
                        onSubmit={submitReport}
                        className="grid gap-4"
                        noValidate
                    >
                        <div className="grid gap-2">
                            <Label htmlFor={reportId}>What’s wrong?</Label>
                            <textarea
                                id={reportId}
                                value={reportReason}
                                onChange={(event) =>
                                    setReportReason(event.target.value)
                                }
                                className={cn(textareaClass, 'min-h-20')}
                                maxLength={500}
                                aria-invalid={reportError ? true : undefined}
                                aria-describedby={
                                    reportError
                                        ? `${reportId}-error`
                                        : undefined
                                }
                            />
                            {reportError && (
                                <p
                                    id={`${reportId}-error`}
                                    className="text-sm text-destructive"
                                >
                                    {reportError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setReporting(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={busy}>
                                {busy && <Spinner />} Send report
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </article>
    );
});
