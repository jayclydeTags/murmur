<?php

use App\Enums\ConversationRole;
use App\Events\ConversationActivity;
use App\Events\MessageSent;
use App\Events\MessageUpdated;
use App\Jobs\FetchLinkPreview;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Notifications\MentionedInMessage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Event::fake([MessageSent::class, MessageUpdated::class, ConversationActivity::class]);
    Notification::fake();
    Queue::fake([FetchLinkPreview::class]);
});

test('members can send a message that is broadcast to the conversation', function () {
    $sender = User::factory()->create();
    $other = User::factory()->create();
    $conversation = Conversation::factory()->withMember($sender)->withMember($other)->create();

    $response = $this->actingAs($sender)->postJson(route('conversations.messages.store', $conversation), [
        'body' => 'Hello team',
        'client_id' => 'client-123',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.body', 'Hello team')
        ->assertJsonPath('data.user.id', $sender->id)
        ->assertJsonPath('client_id', 'client-123');

    $message = Message::sole();

    expect($message->conversation_id)->toBe($conversation->id)
        ->and($conversation->membershipFor($sender)->last_read_message_id)->toBe($message->id)
        ->and($conversation->fresh()->last_message_at)->not->toBeNull();

    Event::assertDispatched(MessageSent::class, fn (MessageSent $event) => $event->message->is($message)
        && $event->clientId === 'client-123'
        && $event->broadcastOn()[0]->name === 'private-conversation.'.$conversation->id);

    Event::assertDispatched(ConversationActivity::class, function (ConversationActivity $event) use ($sender, $other) {
        $channels = collect($event->broadcastOn())->map->name->all();

        return $event->kind === ConversationActivity::KindMessage
            && in_array('private-App.Models.User.'.$sender->id, $channels, true)
            && in_array('private-App.Models.User.'.$other->id, $channels, true);
    });
});

test('people outside a conversation cannot post in it', function () {
    $outsider = User::factory()->create();
    $conversation = Conversation::factory()->privateChannel()->create();

    $this->actingAs($outsider)
        ->postJson(route('conversations.messages.store', $conversation), ['body' => 'Let me in'])
        ->assertForbidden();

    expect(Message::count())->toBe(0);
});

test('a message needs a body or an attachment', function () {
    $sender = User::factory()->create();
    $conversation = Conversation::factory()->withMember($sender)->create();

    $this->actingAs($sender)
        ->postJson(route('conversations.messages.store', $conversation), ['body' => '   '])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['body' => 'Write a message or attach a file.']);
});

test('read-only channels only accept posts from owners and admins', function () {
    $member = User::factory()->create();
    $admin = User::factory()->create();
    $conversation = Conversation::factory()
        ->readOnly()
        ->withMember($member)
        ->withMember($admin, ConversationRole::Admin)
        ->create();

    $this->actingAs($member)
        ->postJson(route('conversations.messages.store', $conversation), ['body' => 'Hi'])
        ->assertForbidden();

    $this->actingAs($admin)
        ->postJson(route('conversations.messages.store', $conversation), ['body' => 'Announcement'])
        ->assertCreated();
});

test('attachments are stored privately with their image dimensions', function () {
    Storage::fake('local');
    $sender = User::factory()->create();
    $conversation = Conversation::factory()->withMember($sender)->create();

    $this->actingAs($sender)
        ->post(route('conversations.messages.store', $conversation), [
            'files' => [UploadedFile::fake()->image('photo.png', 640, 480)],
        ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.attachments.0.name', 'photo.png')
        ->assertJsonPath('data.attachments.0.is_image', true)
        ->assertJsonPath('data.attachments.0.width', 640)
        ->assertJsonPath('data.attachments.0.height', 480);

    $attachment = Message::sole()->attachments()->sole();

    Storage::disk('local')->assertExists($attachment->path);
});

test('attachments are only served to people who can see the conversation', function () {
    Storage::fake('local');
    $sender = User::factory()->create();
    $outsider = User::factory()->create();
    $conversation = Conversation::factory()->privateChannel()->withMember($sender)->create();

    $this->actingAs($sender)->post(route('conversations.messages.store', $conversation), [
        'files' => [UploadedFile::fake()->create('plan.pdf', 12, 'application/pdf')],
    ], ['Accept' => 'application/json'])->assertCreated();

    $attachment = Message::sole()->attachments()->sole();

    $this->actingAs($outsider)->get(route('attachments.show', $attachment))->assertForbidden();
    $this->actingAs($sender)->get(route('attachments.show', $attachment))
        ->assertOk()
        ->assertHeader('X-Content-Type-Options', 'nosniff');
});

test('disallowed file types are rejected', function () {
    $sender = User::factory()->create();
    $conversation = Conversation::factory()->withMember($sender)->create();

    $this->actingAs($sender)
        ->post(route('conversations.messages.store', $conversation), [
            'files' => [UploadedFile::fake()->create('evil.svg', 1, 'image/svg+xml')],
        ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('files.0');
});

test('mentioning a member notifies them but not the sender or non-members', function () {
    $sender = User::factory()->create(['name' => 'Jay Tag']);
    $mentioned = User::factory()->create(['name' => 'Ana Reyes']);
    $bystander = User::factory()->create(['name' => 'Ben Cruz']);
    $outsider = User::factory()->create(['name' => 'Olive Out']);
    $conversation = Conversation::factory()
        ->withMember($sender)
        ->withMember($mentioned)
        ->withMember($bystander)
        ->create();

    $this->actingAs($sender)->postJson(route('conversations.messages.store', $conversation), [
        'body' => 'Thanks @Ana Reyes! cc @Jay Tag and @Olive Out',
    ])->assertCreated();

    Notification::assertSentTo($mentioned, MentionedInMessage::class);
    Notification::assertNotSentTo([$sender, $bystander, $outsider], MentionedInMessage::class);
});

test('replies go into the parent thread and refresh its reply count', function () {
    $sender = User::factory()->create();
    $conversation = Conversation::factory()->withMember($sender)->create();
    $parent = Message::factory()->for($conversation)->for($sender)->create();

    $this->actingAs($sender)->postJson(route('conversations.messages.store', $conversation), [
        'body' => 'In the thread',
        'parent_id' => $parent->id,
    ])->assertCreated()->assertJsonPath('data.parent_id', $parent->id);

    Event::assertDispatched(MessageUpdated::class, fn (MessageUpdated $event) => $event->message->is($parent));

    $this->actingAs($sender)->getJson(route('messages.replies.index', $parent))
        ->assertOk()
        ->assertJsonPath('parent.reply_count', 1)
        ->assertJsonPath('replies.0.body', 'In the thread');
});

test('a thread reply cannot target a message from another conversation', function () {
    $sender = User::factory()->create();
    $conversation = Conversation::factory()->withMember($sender)->create();
    $foreignParent = Message::factory()->create();

    $this->actingAs($sender)->postJson(route('conversations.messages.store', $conversation), [
        'body' => 'Sneaky',
        'parent_id' => $foreignParent->id,
    ])->assertUnprocessable()->assertJsonValidationErrors('parent_id');
});

test('messages with links queue a link preview', function () {
    $sender = User::factory()->create();
    $conversation = Conversation::factory()->withMember($sender)->create();

    $this->actingAs($sender)->postJson(route('conversations.messages.store', $conversation), [
        'body' => 'Look at https://laravel.com/docs.',
    ])->assertCreated();

    Queue::assertPushed(FetchLinkPreview::class);
});

test('older history loads with a cursor', function () {
    $member = User::factory()->create();
    $conversation = Conversation::factory()->withMember($member)->create();
    Message::factory()->count(45)->for($conversation)->for($member)->create();

    $firstPage = $this->actingAs($member)->getJson(route('conversations.messages.index', $conversation))
        ->assertOk()
        ->assertJsonCount(40, 'data');

    $olderPage = $this->actingAs($member)->getJson(route('conversations.messages.index', [
        'conversation' => $conversation,
        'cursor' => $firstPage->json('next_cursor'),
    ]))->assertOk()->assertJsonCount(5, 'data')->assertJsonPath('next_cursor', null);

    expect($olderPage->json('data.4.id'))->toBeLessThan($firstPage->json('data.0.id'));
});
