import { useEffect, useRef } from 'react';
import { Composer } from '@/components/chat/composer';
import { MessageItem } from '@/components/chat/message-item';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { isContinuation } from '@/lib/chat';
import type { ChatMessage, ConversationMemberSummary } from '@/types';

export type ThreadState = {
    parent: ChatMessage;
    replies: ChatMessage[];
    loading: boolean;
    failed: boolean;
};

export function ThreadPanel({
    thread,
    conversationLabel,
    canPost,
    members,
    currentUserId,
    onClose,
    onSend,
    onTyping,
}: {
    thread: ThreadState | null;
    conversationLabel: string;
    canPost: boolean;
    members: ConversationMemberSummary[];
    currentUserId: number;
    onClose: () => void;
    onSend: (body: string, files: File[]) => void;
    onTyping: () => void;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    const replyCount = thread?.replies.length ?? 0;

    useEffect(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    }, [replyCount]);

    return (
        <Sheet
            open={thread !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
            >
                <SheetHeader className="border-b">
                    <SheetTitle>Thread</SheetTitle>
                    <SheetDescription>{conversationLabel}</SheetDescription>
                </SheetHeader>

                {thread && (
                    <>
                        <div
                            ref={scroller}
                            className="min-h-0 flex-1 overflow-y-auto pb-4"
                        >
                            <MessageItem
                                message={thread.parent}
                                continuation={false}
                                inThread
                            />

                            <div className="my-3 flex items-center gap-3 px-4 text-xs text-muted-foreground">
                                <span className="tabular-nums">
                                    {thread.loading
                                        ? 'Loading replies…'
                                        : replyCount === 1
                                          ? '1 reply'
                                          : `${replyCount} replies`}
                                </span>
                                <span
                                    aria-hidden
                                    className="h-px flex-1 bg-border"
                                />
                            </div>

                            {thread.loading ? (
                                <div className="grid gap-4 px-4" aria-hidden>
                                    {[0, 1, 2].map((row) => (
                                        <div key={row} className="flex gap-3">
                                            <Skeleton className="size-9 rounded-md" />
                                            <div className="grid flex-1 gap-2">
                                                <Skeleton className="h-3 w-24" />
                                                <Skeleton className="h-3 w-3/4" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : thread.failed ? (
                                <p className="px-4 text-sm text-destructive">
                                    Couldn’t load this thread. Close it and try
                                    again.
                                </p>
                            ) : replyCount === 0 ? (
                                <p className="px-4 text-sm text-muted-foreground">
                                    No replies yet. Start the thread below.
                                </p>
                            ) : (
                                thread.replies.map((reply, index) => (
                                    <MessageItem
                                        key={reply.client_id ?? reply.id}
                                        message={reply}
                                        continuation={isContinuation(
                                            reply,
                                            thread.replies[index - 1],
                                        )}
                                        inThread
                                    />
                                ))
                            )}
                        </div>

                        <div className="border-t p-3">
                            {canPost && !thread.parent.is_deleted ? (
                                <Composer
                                    key={thread.parent.id}
                                    label="Reply in thread"
                                    placeholder="Reply…"
                                    members={members}
                                    currentUserId={currentUserId}
                                    onSend={onSend}
                                    onTyping={onTyping}
                                    autoFocus
                                />
                            ) : (
                                <p className="text-center text-sm text-muted-foreground">
                                    You can’t reply in this conversation.
                                </p>
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
