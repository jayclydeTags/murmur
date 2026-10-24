<?php

namespace App\Console\Commands;

use App\Jobs\SendUnreadMessagesDigest;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('murmur:send-unread-digests')]
#[Description('Queue an email digest of unread messages for every user who opted in')]
class SendUnreadDigests extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $queued = 0;

        User::query()
            ->where('email_digest_enabled', true)
            ->where(fn ($query) => $query->whereNull('last_digest_sent_at')->orWhere('last_digest_sent_at', '<', now()->subHours(20)))
            ->lazyById()
            ->each(function (User $user) use (&$queued) {
                SendUnreadMessagesDigest::dispatch($user);
                $queued++;
            });

        $this->components->info("Queued {$queued} digest(s).");

        return self::SUCCESS;
    }
}
