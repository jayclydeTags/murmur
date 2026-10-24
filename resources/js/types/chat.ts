export type ConversationType = 'direct' | 'group' | 'channel';

export type ConversationRole = 'owner' | 'admin' | 'member';

export type PresenceStatus = 'online' | 'away' | 'offline';

export type UserSummary = {
    id: number;
    name: string;
    avatar: string | null;
};

export type Conversation = {
    id: number;
    type: ConversationType;
    name: string;
    description: string | null;
    avatar: string | null;
    is_private: boolean;
    is_read_only: boolean;
    last_message_at: string | null;
    direct_user_id?: number;
};

export type SidebarConversation = Conversation & {
    unread_count: number;
    is_muted: boolean;
    is_archived: boolean;
};

export type Membership = {
    role: ConversationRole;
    is_muted: boolean;
    is_archived: boolean;
    last_read_message_id: number | null;
};

export type ConversationMemberSummary = UserSummary & {
    role: ConversationRole;
    last_read_message_id: number | null;
};

export type Attachment = {
    id: number;
    name: string;
    mime_type: string;
    size: number;
    width: number | null;
    height: number | null;
    is_image: boolean;
    url: string;
};

export type Reaction = {
    emoji: string;
    count: number;
    user_ids: number[];
};

export type LinkPreview = {
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
    site_name: string | null;
};

export type Message = {
    id: number;
    conversation_id: number;
    parent_id: number | null;
    body: string | null;
    user: UserSummary | null;
    attachments: Attachment[];
    reactions: Reaction[];
    reply_count: number;
    latest_reply_at: string | null;
    link_preview: LinkPreview | null;
    is_pinned: boolean;
    is_edited: boolean;
    is_deleted: boolean;
    created_at: string;
};

/**
 * A message as the client knows it, including optimistic ones still being sent.
 */
export type ChatMessage = Message & {
    client_id?: string;
    status?: 'sending' | 'failed';
    pending_files?: File[];
};

export type MessageReport = {
    id: number;
    reason: string;
    reporter: UserSummary;
    message: Message;
    created_at: string;
};

export type ConversationPermissions = {
    post: boolean;
    update: boolean;
    moderate: boolean;
    addMembers: boolean;
    join: boolean;
    leave: boolean;
    changeRoles: boolean;
};

export type MentionNotificationData = {
    message_id: number;
    parent_id: number | null;
    conversation_id: number;
    conversation_name: string;
    sender: UserSummary | null;
    excerpt: string;
};

export type ConversationActivityPayload = {
    conversation_id: number;
    kind: 'message' | 'added' | 'removed' | 'updated';
    conversation_type: ConversationType;
    conversation_name: string | null;
    sender: UserSummary | null;
    preview: string | null;
    message_id: number | null;
};
