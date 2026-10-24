import { echo, useEcho } from '@laravel/echo-react';
import { useEffect, useRef } from 'react';
import type { Message } from '@/types';

export type TypingWhisper = {
    id: number;
    name: string;
    parent_id: number | null;
};

export type ConversationChannelHandlers = {
    onMessageSent: (payload: {
        message: Message;
        client_id: string | null;
    }) => void;
    onMessageUpdated: (payload: { message: Message }) => void;
    onMessageDeleted: (payload: {
        message_id: number;
        parent_id: number | null;
    }) => void;
    onMessageRead: (payload: { user_id: number; message_id: number }) => void;
    onConversationUpdated: () => void;
    onTyping: (payload: TypingWhisper) => void;
};

/**
 * Subscribes to a conversation's private channel. Rendered only for members,
 * since the channel authorizer rejects everyone else.
 */
export function ConversationChannel({
    conversationId,
    handlers,
    onReady,
}: {
    conversationId: number;
    handlers: ConversationChannelHandlers;
    onReady: (whisper: (payload: TypingWhisper) => void) => void;
}) {
    const channelName = `conversation.${conversationId}`;
    const latest = useRef(handlers);

    useEffect(() => {
        latest.current = handlers;
    });

    useEcho<{ message: Message; client_id: string | null }>(
        channelName,
        '.MessageSent',
        (payload) => latest.current.onMessageSent(payload),
        [conversationId],
    );
    useEcho<{ message: Message }>(
        channelName,
        '.MessageUpdated',
        (payload) => latest.current.onMessageUpdated(payload),
        [conversationId],
    );
    useEcho<{ message_id: number; parent_id: number | null }>(
        channelName,
        '.MessageDeleted',
        (payload) => latest.current.onMessageDeleted(payload),
        [conversationId],
    );
    useEcho<{ user_id: number; message_id: number }>(
        channelName,
        '.MessageRead',
        (payload) => latest.current.onMessageRead(payload),
        [conversationId],
    );
    useEcho(
        channelName,
        '.ConversationUpdated',
        () => latest.current.onConversationUpdated(),
        [conversationId],
    );

    useEffect(() => {
        const channel = echo().private(channelName);
        const listener = (payload: TypingWhisper) =>
            latest.current.onTyping(payload);

        channel.listenForWhisper('typing', listener);
        onReady((payload) => channel.whisper('typing', payload));

        return () => {
            channel.stopListeningForWhisper('typing', listener);
        };
    }, [channelName, onReady]);

    return null;
}
