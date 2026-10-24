import { Link, usePage } from '@inertiajs/react';
import { Compass, Home, Search } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { ConversationNav } from '@/components/chat/conversation-nav';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { dashboard, search } from '@/routes';
import { index as channelsIndex } from '@/routes/channels';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Home',
        href: dashboard(),
        icon: Home,
    },
    {
        title: 'Browse channels',
        href: channelsIndex(),
        icon: Compass,
    },
    {
        title: 'Search',
        href: search(),
        icon: Search,
    },
];

export function AppSidebar() {
    const { isCurrentUrl } = useCurrentUrl();
    const { unreadNotificationCount } = usePage().props;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup className="py-0">
                    <SidebarMenu>
                        {mainNavItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isCurrentUrl(item.href)}
                                    tooltip={{ children: item.title }}
                                >
                                    <Link href={item.href} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                                {item.title === 'Home' &&
                                    unreadNotificationCount > 0 && (
                                        <SidebarMenuBadge className="rounded-full bg-primary text-primary-foreground tabular-nums">
                                            <span className="sr-only">
                                                Unread mentions:{' '}
                                            </span>
                                            {unreadNotificationCount}
                                        </SidebarMenuBadge>
                                    )}
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>

                <ConversationNav />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
