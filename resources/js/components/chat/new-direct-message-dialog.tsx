import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import DirectConversationController from '@/actions/App/Http/Controllers/Chat/DirectConversationController';
import { PeoplePicker } from '@/components/chat/people-picker';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import type { UserSummary } from '@/types';

/**
 * Pick someone to open a direct message with.
 */
export function NewDirectMessageDialog({ trigger }: { trigger: ReactNode }) {
    const [open, setOpen] = useState(false);

    const start = ([person]: UserSummary[]) => {
        if (!person) {
            return;
        }

        router.post(
            DirectConversationController.store.url(),
            { user_id: person.id },
            { onSuccess: () => setOpen(false) },
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogTitle>New direct message</DialogTitle>
                <DialogDescription>
                    Choose someone to message privately.
                </DialogDescription>
                <PeoplePicker
                    label="To"
                    multiple={false}
                    selected={[]}
                    onChange={start}
                    autoFocus
                />
            </DialogContent>
        </Dialog>
    );
}
