<?php

namespace App\Actions\Chat;

use App\Enums\ConversationRole;
use App\Enums\ConversationType;
use App\Events\ConversationActivity;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class OpenDirectConversation
{
    /**
     * Find the direct conversation between two users, creating it the first time.
     */
    public function handle(User $user, User $recipient): Conversation
    {
        $key = Conversation::directKeyFor($user, $recipient);

        $existing = Conversation::query()->where('direct_key', $key)->first();

        if ($existing !== null) {
            return $existing;
        }

        $conversation = DB::transaction(function () use ($user, $recipient, $key): Conversation {
            $conversation = Conversation::create([
                'type' => ConversationType::Direct,
                'is_private' => true,
                'direct_key' => $key,
                'created_by' => $user->id,
            ]);

            $conversation->members()->syncWithPivotValues(
                array_unique([$user->id, $recipient->id]),
                ['role' => ConversationRole::Member->value],
            );

            return $conversation;
        });

        ConversationActivity::dispatch(
            [$recipient->id],
            $conversation->id,
            ConversationActivity::KindAdded,
            ConversationType::Direct->value,
            $user->name,
            $user->toSummary(),
        );

        return $conversation;
    }
}
