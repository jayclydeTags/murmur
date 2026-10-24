<?php

namespace App\Enums;

enum ConversationType: string
{
    case Direct = 'direct';
    case Group = 'group';
    case Channel = 'channel';
}
