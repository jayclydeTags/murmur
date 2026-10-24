import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import NotificationController from '@/actions/App/Http/Controllers/Settings/NotificationController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { edit } from '@/routes/notifications';

type BrowserPermission = NotificationPermission | 'unsupported';

function currentPermission(): BrowserPermission {
    return typeof Notification === 'undefined'
        ? 'unsupported'
        : Notification.permission;
}

export default function Notifications({
    emailDigestEnabled,
}: {
    emailDigestEnabled: boolean;
}) {
    const [permission, setPermission] =
        useState<BrowserPermission>(currentPermission);
    const [digest, setDigest] = useState(emailDigestEnabled);

    const requestPermission = async () => {
        setPermission(await Notification.requestPermission());
    };

    return (
        <>
            <Head title="Notification settings" />
            <h1 className="sr-only">Notification settings</h1>

            <div className="space-y-10">
                <section className="space-y-4">
                    <Heading
                        variant="small"
                        title="Browser notifications"
                        description="Get a desktop notification for direct messages and mentions when Murmur isn’t the active tab."
                    />
                    {permission === 'unsupported' ? (
                        <p className="text-sm text-muted-foreground">
                            This browser doesn’t support notifications.
                        </p>
                    ) : permission === 'granted' ? (
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">
                            ✓ Browser notifications are on.
                        </p>
                    ) : permission === 'denied' ? (
                        <p className="text-sm text-muted-foreground">
                            Notifications are blocked. Allow them for this site
                            in your browser’s settings, then reload the page.
                        </p>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => void requestPermission()}
                        >
                            Turn on browser notifications
                        </Button>
                    )}
                </section>

                <section className="space-y-4">
                    <Heading
                        variant="small"
                        title="Email digest"
                        description="A once-a-day summary of unread messages, sent only when you have some."
                    />
                    <Form
                        {...NotificationController.update.form()}
                        options={{ preserveScroll: true }}
                        className="space-y-6"
                    >
                        {({ processing }) => (
                            <>
                                <input
                                    type="hidden"
                                    name="email_digest_enabled"
                                    value={digest ? '1' : '0'}
                                />
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="email-digest"
                                        checked={digest}
                                        onCheckedChange={(checked) =>
                                            setDigest(checked === true)
                                        }
                                    />
                                    <div className="grid gap-1">
                                        <Label htmlFor="email-digest">
                                            Email me a daily digest of unread
                                            messages
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Muted and archived conversations are
                                            left out.
                                        </p>
                                    </div>
                                </div>
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />} Save
                                </Button>
                            </>
                        )}
                    </Form>
                </section>
            </div>
        </>
    );
}

Notifications.layout = {
    breadcrumbs: [{ title: 'Notification settings', href: edit() }],
};
