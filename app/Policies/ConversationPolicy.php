<?php

namespace App\Policies;

use App\Enums\ConversationRole;
use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\User;

class ConversationPolicy
{
    /**
     * Members can open a conversation; anyone can preview a public channel.
     */
    public function view(User $user, Conversation $conversation): bool
    {
        return $conversation->isPublicChannel() || $conversation->hasMember($user);
    }

    public function join(User $user, Conversation $conversation): bool
    {
        return $conversation->isPublicChannel() && ! $conversation->hasMember($user);
    }

    public function leave(User $user, Conversation $conversation): bool
    {
        return ! $conversation->isDirect() && $conversation->hasMember($user);
    }

    /**
     * Members can post, except in read-only channels where only owners and admins can.
     */
    public function post(User $user, Conversation $conversation): bool
    {
        $role = $conversation->roleFor($user);

        if ($role === null) {
            return false;
        }

        return ! $conversation->is_read_only || $role->canManage();
    }

    /**
     * Members can react, pin, mark as read and report.
     */
    public function participate(User $user, Conversation $conversation): bool
    {
        return $conversation->hasMember($user);
    }

    /**
     * Owners and admins can rename, lock, and moderate group chats and channels.
     */
    public function update(User $user, Conversation $conversation): bool
    {
        return ! $conversation->isDirect() && (bool) $conversation->roleFor($user)?->canManage();
    }

    public function moderate(User $user, Conversation $conversation): bool
    {
        return $this->update($user, $conversation);
    }

    /**
     * Any member can add people to a group chat; channels need an owner or admin.
     */
    public function addMembers(User $user, Conversation $conversation): bool
    {
        return match ($conversation->type) {
            ConversationType::Direct => false,
            ConversationType::Group => $conversation->hasMember($user),
            ConversationType::Channel => (bool) $conversation->roleFor($user)?->canManage(),
        };
    }

    /**
     * Owners can remove anyone but other owners; admins can remove members.
     */
    public function removeMember(User $user, Conversation $conversation, User $member): bool
    {
        if ($conversation->isDirect() || $user->is($member)) {
            return false;
        }

        $actorRole = $conversation->roleFor($user);
        $targetRole = $conversation->roleFor($member);

        if ($actorRole === null || $targetRole === null || ! $actorRole->canManage()) {
            return false;
        }

        return match ($actorRole) {
            ConversationRole::Owner => $targetRole !== ConversationRole::Owner,
            default => $targetRole === ConversationRole::Member,
        };
    }

    /**
     * Only owners can change other members' roles.
     */
    public function changeRole(User $user, Conversation $conversation, User $member): bool
    {
        return ! $conversation->isDirect()
            && ! $user->is($member)
            && $conversation->roleFor($user) === ConversationRole::Owner
            && $conversation->hasMember($member);
    }
}
