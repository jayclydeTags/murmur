<?php

namespace App\Jobs;

use App\Models\Conversation;
use App\Models\User;
use App\Notifications\UnreadMessagesDigest;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendUnreadMessagesDigest implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(public User $user) {}

    public function uniqueId(): string
    {
        return (string) $this->user->id;
    }

    /**
     * Email the user a summary of unread messages in conversations they haven't muted.
     */
    public function handle(): void
    {
        if (! $this->user->email_digest_enabled) {
            return;
        }

        $conversations = Conversation::sidebarFor($this->user)
            ->filter(fn (Conversation $conversation): bool => (int) $conversation->getAttribute('unread_count') > 0
                && $conversation->getAttribute('member_muted_at') === null
                && $conversation->getAttribute('member_archived_at') === null)
            ->map(fn (Conversation $conversation): array => [
                'name' => $conversation->isDirect() ? $conversation->displayNameFor($this->user) : '#'.$conversation->name,
                'unread_count' => (int) $conversation->getAttribute('unread_count'),
                'url' => route('conversations.show', $conversation),
            ])
            ->values()
            ->all();

        if ($conversations === []) {
            return;
        }

        $this->user->notify(new UnreadMessagesDigest($conversations));
        $this->user->forceFill(['last_digest_sent_at' => now()])->save();
    }
}
