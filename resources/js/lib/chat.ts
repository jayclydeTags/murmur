import type { ChatMessage, Conversation, UserSummary } from '@/types';

const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
});

const dayFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
});

const fullFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export function formatTime(iso: string): string {
    return timeFormatter.format(new Date(iso));
}

export function formatFullDate(iso: string): string {
    return fullFormatter.format(new Date(iso));
}

export function formatDay(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    }

    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    return dayFormatter.format(date);
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(0)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Whether a message continues the previous one closely enough to hide its header.
 */
export function isContinuation(
    message: ChatMessage,
    previous: ChatMessage | undefined,
): boolean {
    if (!previous || !message.user || !previous.user) {
        return false;
    }

    if (message.user.id !== previous.user.id) {
        return false;
    }

    const gap =
        new Date(message.created_at).getTime() -
        new Date(previous.created_at).getTime();

    return (
        gap < 5 * 60 * 1000 &&
        formatDay(message.created_at) === formatDay(previous.created_at)
    );
}

export function conversationLabel(conversation: Conversation): string {
    return conversation.type === 'channel'
        ? `#${conversation.name}`
        : conversation.name;
}

/**
 * Insert or replace messages by id (or client id), keeping them in order.
 */
export function upsertMessages(
    current: ChatMessage[],
    incoming: ChatMessage[],
): ChatMessage[] {
    const next = [...current];

    for (const message of incoming) {
        const index = next.findIndex(
            (existing) =>
                existing.id === message.id ||
                (message.client_id !== undefined &&
                    existing.client_id === message.client_id),
        );

        if (index === -1) {
            next.push(message);
        } else {
            next[index] = { ...message, client_id: next[index].client_id };
        }
    }

    return next.sort((a, b) => {
        const aPending = a.status === undefined ? 0 : 1;
        const bPending = b.status === undefined ? 0 : 1;

        if (aPending !== bPending) {
            return aPending - bPending;
        }

        return aPending === 1 ? 0 : a.id - b.id;
    });
}

export function newClientId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function optimisticMessage(
    user: UserSummary,
    conversationId: number,
    body: string,
    files: File[],
    parentId: number | null,
): ChatMessage {
    const clientId = newClientId();

    return {
        id: -Date.now(),
        client_id: clientId,
        status: 'sending',
        pending_files: files,
        conversation_id: conversationId,
        parent_id: parentId,
        body: body === '' ? null : body,
        user,
        attachments: files.map((file, index) => ({
            id: -index - 1,
            name: file.name,
            mime_type: file.type,
            size: file.size,
            width: null,
            height: null,
            is_image: false,
            url: '#',
        })),
        reactions: [],
        reply_count: 0,
        latest_reply_at: null,
        link_preview: null,
        is_pinned: false,
        is_edited: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
    };
}

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🙏', '👀'];

export function showBrowserNotification(title: string, body: string): void {
    if (
        typeof Notification === 'undefined' ||
        Notification.permission !== 'granted' ||
        !document.hidden
    ) {
        return;
    }

    const notification = new Notification(title, { body, tag: title });

    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}
