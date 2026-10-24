<?php

use App\Jobs\SendUnreadMessagesDigest;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Notifications\UnreadMessagesDigest;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

test('the digest summarises unread messages and skips muted conversations', function () {
    Notification::fake();
    $user = User::factory()->create();
    $loud = Conversation::factory()->withMember($user)->create(['name' => 'general']);
    $muted = Conversation::factory()->withMember($user)->create(['name' => 'random']);
    $muted->memberships()->where('user_id', $user->id)->update(['muted_at' => now()]);
    Message::factory()->count(2)->for($loud)->create();
    Message::factory()->for($muted)->create();

    SendUnreadMessagesDigest::dispatchSync($user);

    Notification::assertSentTo($user, UnreadMessagesDigest::class, fn (UnreadMessagesDigest $digest) => $digest->conversations === [
        ['name' => '#general', 'unread_count' => 2, 'url' => route('conversations.show', $loud)],
    ]);
    expect($user->fresh()->last_digest_sent_at)->not->toBeNull();
});

test('no digest is sent when everything has been read or the user opted out', function () {
    Notification::fake();
    $caughtUp = User::factory()->create();
    $optedOut = User::factory()->create(['email_digest_enabled' => false]);
    $conversation = Conversation::factory()->withMember($caughtUp)->withMember($optedOut)->create();
    Message::factory()->for($conversation)->for($caughtUp)->create();

    SendUnreadMessagesDigest::dispatchSync($caughtUp);
    SendUnreadMessagesDigest::dispatchSync($optedOut);

    Notification::assertNothingSent();
});

test('the digest command queues a job for each opted-in user not emailed recently', function () {
    Queue::fake();
    $due = User::factory()->create();
    User::factory()->create(['email_digest_enabled' => false]);
    User::factory()->create(['last_digest_sent_at' => now()->subHour()]);

    $this->artisan('murmur:send-unread-digests')->assertSuccessful();

    Queue::assertPushed(SendUnreadMessagesDigest::class, 1);
    Queue::assertPushed(SendUnreadMessagesDigest::class, fn (SendUnreadMessagesDigest $job) => $job->user->is($due));
});

test('users can turn the digest off in their settings', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('notifications.update'), ['email_digest_enabled' => false])
        ->assertRedirect(route('notifications.edit'));

    expect($user->fresh()->email_digest_enabled)->toBeFalse();
});
