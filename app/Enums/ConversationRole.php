<?php

namespace App\Enums;

enum ConversationRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Member = 'member';

    /**
     * Determine whether the role may manage the conversation.
     */
    public function canManage(): bool
    {
        return $this === self::Owner || $this === self::Admin;
    }
}
