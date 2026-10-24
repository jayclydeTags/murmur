<?php

use App\Events\MessageRead;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([MessageRead::class]);
});

test('marking a conversation read moves the pointer forward and broadcasts it', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create();
    $message = Message::factory()->for($conversation)->create();

    $this->actingAs($member)
        ->postJson(route('conversations.read', $conversation), ['message_id' => $message->id])
        ->assertNoContent();

    expect($conversation->membershipFor($member)->last_read_message_id)->toBe($message->id);
    Event::assertDispatched(MessageRead::class, fn (MessageRead $event) => $event->userId === $member->id
        && $event->messageId === $message->id);
});

test('the read pointer never moves backwards', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create();
    [$older, $newer] = Message::factory()->count(2)->for($conversation)->create();
    $conversation->memberships()->where('user_id', $member->id)->update(['last_read_message_id' => $newer->id]);

    $this->actingAs($member)
        ->postJson(route('conversations.read', $conversation), ['message_id' => $older->id])
        ->assertNoContent();

    expect($conversation->membershipFor($member)->last_read_message_id)->toBe($newer->id);
    Event::assertNotDispatched(MessageRead::class);
});

test('a message from another conversation cannot be marked read', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create();

    $this->actingAs($member)
        ->postJson(route('conversations.read', $conversation), ['message_id' => Message::factory()->create()->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('message_id');
});

test('non-members cannot mark a conversation read', function () {
    $conversation = Conversation::factory()->create();
    $message = Message::factory()->for($conversation)->create();

    $this->actingAs(User::factory()->create())
        ->postJson(route('conversations.read', $conversation), ['message_id' => $message->id])
        ->assertForbidden();
});

test('reading a conversation clears its mention notifications', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create();
    $message = Message::factory()->for($conversation)->create();
    $member->notifications()->create([
        'id' => (string) str()->uuid(),
        'type' => 'mention',
        'data' => ['conversation_id' => $conversation->id, 'message_id' => $message->id],
    ]);

    $this->actingAs($member)->postJson(route('conversations.read', $conversation), ['message_id' => $message->id]);

    expect($member->unreadNotifications()->count())->toBe(0);
});
