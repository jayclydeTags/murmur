import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import ConversationController from '@/actions/App/Http/Controllers/Chat/ConversationController';
import InputError from '@/components/input-error';
import { PeoplePicker } from '@/components/chat/people-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { UserSummary } from '@/types';

type Kind = 'channel' | 'group';

/**
 * Create a channel (public or invite-only) or a named group chat.
 */
export function NewConversationDialog({
    kind,
    trigger,
}: {
    kind: Kind;
    trigger: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [people, setPeople] = useState<UserSummary[]>([]);
    const form = useForm({
        type: kind as string,
        name: '',
        description: '',
        is_private: false,
        member_ids: [] as number[],
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            member_ids: people.map((person) => person.id),
        }));
        form.submit(ConversationController.store(), {
            onSuccess: () => {
                setOpen(false);
                form.reset();
                setPeople([]);
            },
            onError: (errors) => {
                if (errors.name) {
                    document.getElementById(`${kind}-name`)?.focus();
                }
            },
        });
    };

    const isChannel = kind === 'channel';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <DialogTitle>
                    {isChannel ? 'Create a channel' : 'Start a group chat'}
                </DialogTitle>
                <DialogDescription>
                    {isChannel
                        ? 'Channels are where your team talks about a topic. Public channels can be joined by anyone in the workspace.'
                        : 'Group chats are private conversations with a few people.'}
                </DialogDescription>

                <form onSubmit={submit} className="grid gap-4" noValidate>
                    <div className="grid gap-2">
                        <Label htmlFor={`${kind}-name`}>Name</Label>
                        <Input
                            id={`${kind}-name`}
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            placeholder={
                                isChannel
                                    ? 'e.g. design-team'
                                    : 'e.g. Launch crew'
                            }
                            autoComplete="off"
                            maxLength={80}
                            required
                            aria-invalid={form.errors.name ? true : undefined}
                            className="text-base md:text-sm"
                        />
                        <InputError message={form.errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`${kind}-description`}>
                            Description{' '}
                            <span className="font-normal text-muted-foreground">
                                (optional)
                            </span>
                        </Label>
                        <Input
                            id={`${kind}-description`}
                            value={form.data.description}
                            onChange={(event) =>
                                form.setData('description', event.target.value)
                            }
                            autoComplete="off"
                            maxLength={500}
                            className="text-base md:text-sm"
                        />
                        <InputError message={form.errors.description} />
                    </div>

                    {isChannel && (
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="channel-private"
                                checked={form.data.is_private}
                                onCheckedChange={(checked) =>
                                    form.setData('is_private', checked === true)
                                }
                            />
                            <div className="grid gap-1">
                                <Label htmlFor="channel-private">
                                    Make private
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Only invited people can see and join it.
                                </p>
                            </div>
                        </div>
                    )}

                    <PeoplePicker
                        label={
                            isChannel
                                ? 'Invite people (optional)'
                                : 'Add people'
                        }
                        selected={people}
                        onChange={setPeople}
                    />
                    <InputError message={form.errors.member_ids} />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            {isChannel ? 'Create channel' : 'Create group'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
