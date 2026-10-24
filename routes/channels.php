<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function (User $user, int $id) {
    return $user->id === $id;
});

Broadcast::channel('conversation.{conversation}', function (User $user, Conversation $conversation) {
    return $conversation->hasMember($user);
});

Broadcast::channel('online', function (User $user) {
    return $user->toSummary();
});
