import { createContext, useContext } from 'react';
import type {
    ChatMessage,
    ConversationMemberSummary,
    ConversationPermissions,
    Membership,
    User,
} from '@/types';

export type ChatActions = {
    toggleReaction: (message: ChatMessage, emoji: string) => void;
    togglePin: (message: ChatMessage) => void;
    edit: (message: ChatMessage, body: string) => Promise<void>;
    remove: (message: ChatMessage) => Promise<void>;
    report: (message: ChatMessage, reason: string) => Promise<void>;
    openThread: (message: ChatMessage) => void;
    retry: (message: ChatMessage) => void;
    discard: (message: ChatMessage) => void;
};

export type ChatContextValue = {
    currentUser: User;
    members: ConversationMemberSummary[];
    membership: Membership | null;
    can: ConversationPermissions;
    actions: ChatActions;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
    const value = useContext(ChatContext);

    if (value === null) {
        throw new Error('useChat must be used inside a conversation.');
    }

    return value;
}
