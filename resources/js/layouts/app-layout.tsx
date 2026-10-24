import { usePage } from '@inertiajs/react';
import { RealtimeNotifications } from '@/components/chat/realtime-notifications';
import { PresenceProvider } from '@/hooks/use-presence';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
}) {
    const { auth } = usePage().props;

    return (
        <PresenceProvider userId={auth.user.id}>
            <RealtimeNotifications userId={auth.user.id} />
            <AppLayoutTemplate breadcrumbs={breadcrumbs}>
                {children}
            </AppLayoutTemplate>
        </PresenceProvider>
    );
}
