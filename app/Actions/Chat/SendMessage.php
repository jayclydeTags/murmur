<?php

namespace App\Actions\Chat;

use App\Events\ConversationActivity;
use App\Events\MessageSent;
use App\Events\MessageUpdated;
use App\Jobs\FetchLinkPreview;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Notifications\MentionedInMessage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class SendMessage
{
    /**
     * Post a message (or thread reply) and fan it out to everyone in the conversation.
     *
     * @param  array<int, UploadedFile>  $files
     */
    public function handle(
        User $sender,
        Conversation $conversation,
        ?string $body,
        array $files = [],
        ?Message $parent = null,
        ?string $clientId = null,
    ): Message {
        $message = DB::transaction(function () use ($sender, $conversation, $body, $files, $parent): Message {
            $message = $conversation->messages()->create([
                'user_id' => $sender->id,
                'parent_id' => $parent?->id,
                'body' => $body,
            ]);

            foreach ($files as $file) {
                $this->storeAttachment($message, $file);
            }

            $conversation->update(['last_message_at' => $message->created_at]);

            if ($parent === null) {
                $conversation->memberships()
                    ->where('user_id', $sender->id)
                    ->update(['last_read_message_id' => $message->id]);
            }

            if ($conversation->isDirect()) {
                $conversation->memberships()->whereNotNull('archived_at')->update(['archived_at' => null]);
            }

            return $message;
        });

        MessageSent::dispatch($message, $clientId);

        if ($parent !== null) {
            MessageUpdated::dispatch($parent);
        }

        $memberIds = $conversation->memberships()->pluck('user_id')->all();
        $conversation->loadMissing('members');

        ConversationActivity::dispatch(
            $memberIds,
            $conversation->id,
            ConversationActivity::KindMessage,
            $conversation->type->value,
            $conversation->isDirect() ? $sender->name : $conversation->name,
            $sender->toSummary(),
            Str::limit((string) ($body ?: __('Sent an attachment')), 120),
            $message->id,
        );

        $mentioned = $this->mentionedMembers($conversation, $sender, $body);

        if ($mentioned->isNotEmpty()) {
            Notification::send($mentioned, new MentionedInMessage($message));
        }

        if (FetchLinkPreview::firstUrlIn($body) !== null) {
            FetchLinkPreview::dispatch($message);
        }

        return $message;
    }

    /**
     * Find the members named with an @mention in the body.
     *
     * @return Collection<int, User>
     */
    public function mentionedMembers(Conversation $conversation, User $sender, ?string $body): Collection
    {
        if ($body === null || ! str_contains($body, '@')) {
            return collect();
        }

        return $conversation->members
            ->reject(fn (User $member): bool => $member->is($sender))
            ->filter(fn (User $member): bool => (bool) preg_match(
                '/(?<![\w@])@'.preg_quote($member->name, '/').'(?![\w])/iu',
                $body,
            ))
            ->values();
    }

    private function storeAttachment(Message $message, UploadedFile $file): void
    {
        $path = $file->store('attachments/'.$message->conversation_id, 'local');
        $dimensions = str_starts_with((string) $file->getMimeType(), 'image/') ? @getimagesize($file->getRealPath()) : false;

        $message->attachments()->create([
            'disk' => 'local',
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => (string) $file->getMimeType(),
            'size' => (int) $file->getSize(),
            'width' => $dimensions ? $dimensions[0] : null,
            'height' => $dimensions ? $dimensions[1] : null,
        ]);
    }
}
