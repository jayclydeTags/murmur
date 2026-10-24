import { Link, usePage } from '@inertiajs/react';
import {
    Archive,
    BellOff,
    ChevronRight,
    Hash,
    Lock,
    Plus,
    Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NewConversationDialog } from '@/components/chat/new-conversation-dialog';
import { NewDirectMessageDialog } from '@/components/chat/new-direct-message-dialog';
import { UserAvatar } from '@/components/chat/user-avatar';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { show } from '@/routes/conversations';
import type { SidebarConversation } from '@/types';

function ConversationIcon({
    conversation,
}: {
    conversation: SidebarConversation;
}) {
    if (conversation.type === 'direct') {
        return (
            <UserAvatar
                user={{
                    id: conversation.direct_user_id ?? 0,
                    name: conversation.name,
                    avatar: conversation.avatar,
                }}
                showPresence
                className="size-5 rounded"
            />
        );
    }

    if (conversation.type === 'group') {
        return <Users aria-hidden />;
    }

    return conversation.is_private ? (
        <Lock aria-hidden />
    ) : (
        <Hash aria-hidden />
    );
}

function ConversationItem({
    conversation,
}: {
    conversation: SidebarConversation;
}) {
    const page = usePage<{ conversation?: { id: number } }>();
    const isActive = page.props.conversation?.id === conversation.id;
    const hasUnread = conversation.unread_count > 0 && !isActive;
    const label =
        conversation.unread_count > 0
            ? `${conversation.name}, ${conversation.unread_count} unread`
            : conversation.name;

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={{ children: conversation.name }}
                className={cn(
                    hasUnread &&
                        !conversation.is_muted &&
                        'font-semibold text-sidebar-foreground',
                )}
            >
                <Link href={show(conversation.id)} prefetch aria-label={label}>
                    <ConversationIcon conversation={conversation} />
                    <span
                        className={cn(
                            'truncate',
                            conversation.is_muted && 'text-muted-foreground',
                        )}
                    >
                        {conversation.name}
                    </span>
                    {conversation.is_muted && (
                        <BellOff
                            aria-label="Muted"
                            className="ml-auto size-3.5! text-muted-foreground"
                        />
                    )}
                </Link>
            </SidebarMenuButton>
            {hasUnread && (
                <SidebarMenuBadge
                    className={cn(
                        'rounded-full tabular-nums',
                        conversation.is_muted
                            ? 'bg-transparent text-muted-foreground'
                            : 'bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground',
                    )}
                    aria-hidden
                >
                    {conversation.unread_count > 99
                        ? '99+'
                        : conversation.unread_count}
                </SidebarMenuBadge>
            )}
        </SidebarMenuItem>
    );
}

function Section({
    title,
    action,
    conversations,
    empty,
}: {
    title: string;
    action: ReactNode;
    conversations: SidebarConversation[];
    empty: string;
}) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{title}</SidebarGroupLabel>
            {action}
            <SidebarGroupContent>
                <SidebarMenu>
                    {conversations.length === 0 ? (
                        <li className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                            {empty}
                        </li>
                    ) : (
                        conversations.map((conversation) => (
                            <ConversationItem
                                key={conversation.id}
                                conversation={conversation}
                            />
                        ))
                    )}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function AddButton({
    label,
    ...props
}: { label: string } & React.ComponentProps<'button'>) {
    return (
        <SidebarGroupAction
            title={label}
            aria-label={label}
            className="after:-inset-3"
            {...props}
        >
            <Plus />
        </SidebarGroupAction>
    );
}

export function ConversationNav() {
    const { sidebar } = usePage().props;
    const active = sidebar.filter((conversation) => !conversation.is_archived);
    const archived = sidebar.filter((conversation) => conversation.is_archived);

    return (
        <>
            <Section
                title="Channels"
                conversations={active.filter(
                    (conversation) => conversation.type === 'channel',
                )}
                empty="Join or create a channel"
                action={
                    <NewConversationDialog
                        kind="channel"
                        trigger={<AddButton label="Create a channel" />}
                    />
                }
            />
            <Section
                title="Direct messages"
                conversations={active.filter(
                    (conversation) => conversation.type === 'direct',
                )}
                empty="No direct messages yet"
                action={
                    <NewDirectMessageDialog
                        trigger={<AddButton label="New direct message" />}
                    />
                }
            />
            <Section
                title="Groups"
                conversations={active.filter(
                    (conversation) => conversation.type === 'group',
                )}
                empty="No group chats yet"
                action={
                    <NewConversationDialog
                        kind="group"
                        trigger={<AddButton label="Start a group chat" />}
                    />
                }
            />
            {archived.length > 0 && (
                <Collapsible className="group/archived">
                    <SidebarGroup>
                        <SidebarGroupLabel asChild>
                            <CollapsibleTrigger className="w-full gap-1">
                                <Archive aria-hidden className="size-3.5" />
                                Archived ({archived.length})
                                <ChevronRight
                                    aria-hidden
                                    className="ml-auto transition-transform group-data-[state=open]/archived:rotate-90 motion-reduce:transition-none"
                                />
                            </CollapsibleTrigger>
                        </SidebarGroupLabel>
                        <CollapsibleContent>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {archived.map((conversation) => (
                                        <ConversationItem
                                            key={conversation.id}
                                            conversation={conversation}
                                        />
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </CollapsibleContent>
                    </SidebarGroup>
                </Collapsible>
            )}
        </>
    );
}
