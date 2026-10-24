<?php

namespace App\Policies;

use App\Models\Message;
use App\Models\User;

class MessagePolicy
{
    /**
     * Authors can edit their own messages.
     */
    public function update(User $user, Message $message): bool
    {
        return $message->user_id === $user->id
            && ! $message->trashed()
            && $message->conversation->hasMember($user);
    }

    /**
     * Authors can delete their own messages; owners and admins can delete any message.
     */
    public function delete(User $user, Message $message): bool
    {
        if ($message->trashed()) {
            return false;
        }

        $role = $message->conversation->roleFor($user);

        if ($role === null) {
            return false;
        }

        return $message->user_id === $user->id || $role->canManage();
    }

    /**
     * Members can report messages written by someone else.
     */
    public function report(User $user, Message $message): bool
    {
        return $message->user_id !== $user->id
            && ! $message->trashed()
            && $message->conversation->hasMember($user);
    }
}
