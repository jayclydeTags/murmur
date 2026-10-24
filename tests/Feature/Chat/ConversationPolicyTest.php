<?php

use App\Enums\ConversationRole;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/**
 * Builds a channel where each role is held by a different user.
 *
 * @return array{conversation: Conversation, owner: User, admin: User, member: User, outsider: User}
 */
function channelWithRoles(): array
{
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();

    $conversation = Conversation::factory()
        ->privateChannel()
        ->withMember($owner, ConversationRole::Owner)
        ->withMember($admin, ConversationRole::Admin)
        ->withMember($member)
        ->create();

    return ['conversation' => $conversation, 'owner' => $owner, 'admin' => $admin, 'member' => $member, 'outsider' => User::factory()->create()];
}

test('who can manage a channel', function (string $actor, bool $canManage) {
    $roles = channelWithRoles();

    expect($roles[$actor]->can('update', $roles['conversation']))->toBe($canManage)
        ->and($roles[$actor]->can('addMembers', $roles['conversation']))->toBe($canManage);
})->with([
    'owner' => ['owner', true],
    'admin' => ['admin', true],
    'member' => ['member', false],
    'outsider' => ['outsider', false],
]);

test('who can remove whom', function (string $actor, string $target, bool $allowed) {
    $roles = channelWithRoles();

    expect($roles[$actor]->can('removeMember', [$roles['conversation'], $roles[$target]]))->toBe($allowed);
})->with([
    'owner removes admin' => ['owner', 'admin', true],
    'owner removes member' => ['owner', 'member', true],
    'owner removes self' => ['owner', 'owner', false],
    'admin removes member' => ['admin', 'member', true],
    'admin removes owner' => ['admin', 'owner', false],
    'member removes member' => ['member', 'admin', false],
]);

test('only owners change roles', function (string $actor, bool $allowed) {
    $roles = channelWithRoles();

    expect($roles[$actor]->can('changeRole', [$roles['conversation'], $roles['member']]))->toBe($allowed);
})->with([
    'owner' => ['owner', true],
    'admin' => ['admin', false],
]);

test('direct messages cannot be managed or left', function () {
    $first = User::factory()->create();
    $second = User::factory()->create();
    $direct = Conversation::factory()->direct($first, $second)->create();

    expect($first->can('update', $direct))->toBeFalse()
        ->and($first->can('addMembers', $direct))->toBeFalse()
        ->and($first->can('leave', $direct))->toBeFalse()
        ->and($first->can('removeMember', [$direct, $second]))->toBeFalse()
        ->and($first->can('post', $direct))->toBeTrue();
});

test('the conversation broadcast channel only admits members', function () {
    $roles = channelWithRoles();
    $authorizeConversation = Broadcast::driver()->getChannels()->get('conversation.{conversation}');

    expect($authorizeConversation($roles['member'], $roles['conversation']))->toBeTrue()
        ->and($authorizeConversation($roles['outsider'], $roles['conversation']))->toBeFalse();
});
