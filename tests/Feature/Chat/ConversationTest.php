<?php

use App\Enums\ConversationRole;
use App\Enums\ConversationType;
use App\Events\ConversationActivity;
use App\Events\ConversationUpdated;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Event::fake([ConversationActivity::class, ConversationUpdated::class]);
});

test('guests are redirected to log in', function () {
    $conversation = Conversation::factory()->create();

    $this->get(route('conversations.show', $conversation))->assertRedirect(route('login'));
});

test('members see the conversation with its latest messages', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create();
    $messages = Message::factory()->count(3)->for($conversation)->create();

    $this->actingAs($member)
        ->get(route('conversations.show', $conversation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('conversations/show')
            ->where('conversation.id', $conversation->id)
            ->where('membership.role', 'member')
            ->has('messages', 3)
            ->where('messages.2.id', $messages->last()->id)
            ->where('can.post', true));
});

test('anyone can preview a public channel but only members see private ones', function () {
    $outsider = User::factory()->create();
    $public = Conversation::factory()->create();
    $private = Conversation::factory()->privateChannel()->create();

    $this->actingAs($outsider)
        ->get(route('conversations.show', $public))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('membership', null)
            ->where('can.join', true)
            ->where('can.post', false));

    $this->actingAs($outsider)->get(route('conversations.show', $private))->assertForbidden();
});

test('the sidebar lists conversations with unread counts', function () {
    $member = User::factory()->create();
    $other = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->withMember($other)->create();
    $read = Message::factory()->for($conversation)->for($other)->create();
    Message::factory()->count(2)->for($conversation)->for($other)->create();
    Message::factory()->for($conversation)->for($member)->create();
    Message::factory()->replyTo($read)->for($other)->create();
    $conversation->memberships()->where('user_id', $member->id)->update(['last_read_message_id' => $read->id]);

    $this->actingAs($member)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('sidebar', 1)
            ->where('sidebar.0.id', $conversation->id)
            ->where('sidebar.0.unread_count', 2));
});

test('users can create a channel and become its owner', function () {
    $creator = User::factory()->create();
    $invitee = User::factory()->create();

    $response = $this->actingAs($creator)->post(route('conversations.store'), [
        'type' => 'channel',
        'name' => 'design',
        'is_private' => true,
        'member_ids' => [$invitee->id],
    ]);

    $conversation = Conversation::sole();
    $response->assertRedirect(route('conversations.show', $conversation));

    expect($conversation->type)->toBe(ConversationType::Channel)
        ->and($conversation->is_private)->toBeTrue()
        ->and($conversation->roleFor($creator))->toBe(ConversationRole::Owner)
        ->and($conversation->roleFor($invitee))->toBe(ConversationRole::Member);

    Event::assertDispatched(ConversationActivity::class, fn (ConversationActivity $event) => $event->userIds === [$invitee->id]
        && $event->kind === ConversationActivity::KindAdded);
});

test('creating a conversation requires a name', function () {
    $this->actingAs(User::factory()->create())
        ->post(route('conversations.store'), ['type' => 'group', 'name' => ''])
        ->assertSessionHasErrors(['name' => 'The name field is required.']);
});

test('direct messages are reused between the same two people', function () {
    $user = User::factory()->create();
    $recipient = User::factory()->create();

    $this->actingAs($user)->post(route('conversations.direct.store'), ['user_id' => $recipient->id])->assertRedirect();
    $this->actingAs($recipient)->post(route('conversations.direct.store'), ['user_id' => $user->id])->assertRedirect();

    $conversation = Conversation::sole();

    expect($conversation->isDirect())->toBeTrue()
        ->and($conversation->memberships()->count())->toBe(2);

    Event::assertDispatchedTimes(ConversationActivity::class, 1);
});

test('users can join public channels but not private ones', function () {
    $user = User::factory()->create();
    $public = Conversation::factory()->create();
    $private = Conversation::factory()->privateChannel()->create();

    $this->actingAs($user)->post(route('conversations.join', $public))->assertRedirect(route('conversations.show', $public));
    $this->actingAs($user)->post(route('conversations.join', $private))->assertForbidden();

    expect($public->hasMember($user))->toBeTrue()
        ->and($private->hasMember($user))->toBeFalse();
});

test('when the last owner leaves, ownership passes to an admin first', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $admin = User::factory()->create();
    $conversation = Conversation::factory()
        ->withMember($owner, ConversationRole::Owner)
        ->withMember($member)
        ->withMember($admin, ConversationRole::Admin)
        ->create();

    $this->actingAs($owner)->delete(route('conversations.leave', $conversation))->assertRedirect(route('dashboard'));

    expect($conversation->hasMember($owner))->toBeFalse()
        ->and($conversation->roleFor($admin))->toBe(ConversationRole::Owner)
        ->and($conversation->roleFor($member))->toBe(ConversationRole::Member);
});

test('admins can rename and lock a channel', function () {
    $admin = User::factory()->create();
    $conversation = Conversation::factory()->withMember($admin, ConversationRole::Admin)->create();

    $this->actingAs($admin)->patch(route('conversations.update', $conversation), [
        'name' => 'announcements',
        'is_read_only' => true,
    ])->assertRedirect();

    expect($conversation->fresh())
        ->name->toBe('announcements')
        ->is_read_only->toBeTrue();

    Event::assertDispatched(ConversationUpdated::class);
});

test('members cannot rename a channel', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create(['name' => 'general']);

    $this->actingAs($member)
        ->patch(route('conversations.update', $conversation), ['name' => 'mine'])
        ->assertForbidden();

    expect($conversation->fresh()->name)->toBe('general');
});

test('admins can remove members and the removed person is told', function () {
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($admin, ConversationRole::Admin)->withMember($member)->create();

    $this->actingAs($admin)->delete(route('conversations.members.destroy', [$conversation, $member]))->assertRedirect();

    expect($conversation->hasMember($member))->toBeFalse();
    Event::assertDispatched(ConversationActivity::class, fn (ConversationActivity $event) => $event->userIds === [$member->id]
        && $event->kind === ConversationActivity::KindRemoved);
});

test('members cannot remove each other', function () {
    $member = User::factory()->create();
    $other = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->withMember($other)->create();

    $this->actingAs($member)->delete(route('conversations.members.destroy', [$conversation, $other]))->assertForbidden();

    expect($conversation->hasMember($other))->toBeTrue();
});

test('anyone in a group chat can add people', function () {
    $member = User::factory()->create();
    $newcomer = User::factory()->create();
    $group = Conversation::factory()->group()->withMember($member)->create();

    $this->actingAs($member)
        ->post(route('conversations.members.store', $group), ['user_ids' => [$newcomer->id]])
        ->assertRedirect();

    expect($group->roleFor($newcomer))->toBe(ConversationRole::Member);
});

test('members can mute and archive a conversation for themselves', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create();

    $this->actingAs($member)->patch(route('conversations.preferences.update', $conversation), ['muted' => true])->assertRedirect();
    $this->actingAs($member)->patch(route('conversations.preferences.update', $conversation), ['archived' => true])->assertRedirect();

    $membership = $conversation->membershipFor($member);

    expect($membership->muted_at)->not->toBeNull()
        ->and($membership->archived_at)->not->toBeNull();
});

test('search only returns messages from conversations the user belongs to', function () {
    $user = User::factory()->create();
    $mine = Conversation::factory()->withMember($user)->create();
    $theirs = Conversation::factory()->privateChannel()->create();
    Message::factory()->for($mine)->create(['body' => 'The deploy is done']);
    Message::factory()->for($theirs)->create(['body' => 'Secret deploy notes']);

    $this->actingAs($user)
        ->get(route('search', ['q' => 'deploy']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('search')
            ->has('messages', 1)
            ->where('messages.0.body', 'The deploy is done'));
});
