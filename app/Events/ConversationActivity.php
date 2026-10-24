<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Broadcast to each affected user's private channel so their sidebar stays current.
 */
class ConversationActivity implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public const KindMessage = 'message';

    public const KindAdded = 'added';

    public const KindRemoved = 'removed';

    public const KindUpdated = 'updated';

    /**
     * Create a new event instance.
     *
     * @param  array<int, int>  $userIds
     * @param  array{id: int, name: string, avatar: string|null}|null  $sender
     */
    public function __construct(
        public array $userIds,
        public int $conversationId,
        public string $kind,
        public string $conversationType,
        public ?string $conversationName = null,
        public ?array $sender = null,
        public ?string $preview = null,
        public ?int $messageId = null,
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return array_map(
            fn (int $userId): PrivateChannel => new PrivateChannel('App.Models.User.'.$userId),
            array_values(array_unique($this->userIds)),
        );
    }

    public function broadcastAs(): string
    {
        return 'ConversationActivity';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'kind' => $this->kind,
            'conversation_type' => $this->conversationType,
            'conversation_name' => $this->conversationName,
            'sender' => $this->sender,
            'preview' => $this->preview,
            'message_id' => $this->messageId,
        ];
    }
}
