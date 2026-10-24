<?php

use App\Enums\ConversationRole;
use App\Events\MessageDeleted;
use App\Events\MessageUpdated;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageReport;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([MessageUpdated::class, MessageDeleted::class]);
});

test('authors can edit their own messages', function () {
    $author = User::factory()->create();
    $conversation = Conversation::factory()->withMember($author)->create();
    $message = Message::factory()->for($conversation)->for($author)->create(['body' => 'Helo']);

    $this->actingAs($author)
        ->patchJson(route('messages.update', $message), ['body' => 'Hello'])
        ->assertOk()
        ->assertJsonPath('data.body', 'Hello')
        ->assertJsonPath('data.is_edited', true);

    Event::assertDispatched(MessageUpdated::class);
});

test('nobody can edit someone else’s message, not even an admin', function () {
    $author = User::factory()->create();
    $admin = User::factory()->create();
    $conversation = Conversation::factory()->withMember($author)->withMember($admin, ConversationRole::Admin)->create();
    $message = Message::factory()->for($conversation)->for($author)->create(['body' => 'Original']);

    $this->actingAs($admin)
        ->patchJson(route('messages.update', $message), ['body' => 'Changed'])
        ->assertForbidden();

    expect($message->fresh()->body)->toBe('Original');
});

test('authors can delete their own messages', function () {
    $author = User::factory()->create();
    $conversation = Conversation::factory()->withMember($author)->create();
    $message = Message::factory()->for($conversation)->for($author)->create();

    $this->actingAs($author)->deleteJson(route('messages.destroy', $message))->assertNoContent();

    $this->assertSoftDeleted($message);
    Event::assertDispatched(MessageDeleted::class, fn (MessageDeleted $event) => $event->messageId === $message->id);
});

test('admins can delete other members’ messages and close their reports', function () {
    $author = User::factory()->create();
    $admin = User::factory()->create();
    $conversation = Conversation::factory()->withMember($author)->withMember($admin, ConversationRole::Admin)->create();
    $message = Message::factory()->for($conversation)->for($author)->create();
    $report = MessageReport::factory()->for($message)->create();

    $this->actingAs($admin)->deleteJson(route('messages.destroy', $message))->assertNoContent();

    $this->assertSoftDeleted($message);
    expect($message->fresh()->deleted_by)->toBe($admin->id)
        ->and($report->fresh()->resolved_at)->not->toBeNull();
});

test('members cannot delete other members’ messages', function () {
    $author = User::factory()->create();
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($author)->withMember($member)->create();
    $message = Message::factory()->for($conversation)->for($author)->create();

    $this->actingAs($member)->deleteJson(route('messages.destroy', $message))->assertForbidden();

    $this->assertNotSoftDeleted($message);
});

test('reacting toggles the emoji on and off', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create();
    $message = Message::factory()->for($conversation)->create();

    $this->actingAs($member)
        ->postJson(route('messages.reactions.store', $message), ['emoji' => '🎉'])
        ->assertOk()
        ->assertJsonPath('data.reactions.0.emoji', '🎉')
        ->assertJsonPath('data.reactions.0.user_ids', [$member->id]);

    $this->actingAs($member)
        ->postJson(route('messages.reactions.store', $message), ['emoji' => '🎉'])
        ->assertOk()
        ->assertJsonPath('data.reactions', []);

    Event::assertDispatchedTimes(MessageUpdated::class, 2);
});

test('outsiders cannot react to messages', function () {
    $outsider = User::factory()->create();
    $message = Message::factory()->for(Conversation::factory()->privateChannel())->create();

    $this->actingAs($outsider)
        ->postJson(route('messages.reactions.store', $message), ['emoji' => '👍'])
        ->assertForbidden();
});

test('members can pin and unpin messages', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create();
    $message = Message::factory()->for($conversation)->create();

    $this->actingAs($member)->postJson(route('messages.pin.store', $message))
        ->assertOk()
        ->assertJsonPath('data.is_pinned', true);

    expect($message->fresh()->pinned_by)->toBe($member->id);

    $this->actingAs($member)->deleteJson(route('messages.pin.destroy', $message))
        ->assertOk()
        ->assertJsonPath('data.is_pinned', false);
});

test('members can report other people’s messages but not their own', function () {
    $author = User::factory()->create();
    $reporter = User::factory()->create();
    $conversation = Conversation::factory()->withMember($author)->withMember($reporter)->create();
    $message = Message::factory()->for($conversation)->for($author)->create();

    $this->actingAs($reporter)
        ->postJson(route('messages.reports.store', $message), ['reason' => 'Spam'])
        ->assertCreated();

    $this->actingAs($author)
        ->postJson(route('messages.reports.store', $message), ['reason' => 'Oops'])
        ->assertForbidden();

    expect(MessageReport::sole()->reporter_id)->toBe($reporter->id);
});

test('only moderators can dismiss reports', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($owner, ConversationRole::Owner)->withMember($member)->create();
    $report = MessageReport::factory()->for(Message::factory()->for($conversation))->create();

    $this->actingAs($member)->patch(route('reports.update', $report))->assertForbidden();

    $this->actingAs($owner)->patch(route('reports.update', $report))->assertRedirect();

    expect($report->fresh()->resolved_by)->toBe($owner->id);
});
