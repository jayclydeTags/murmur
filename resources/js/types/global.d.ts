import type { Auth } from '@/types/auth';
import type { SidebarConversation } from '@/types/chat';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            sidebar: SidebarConversation[];
            unreadNotificationCount: number;
            [key: string]: unknown;
        };
    }
}
