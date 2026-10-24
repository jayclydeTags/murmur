<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class MessageDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    /**
     * Create a new event instance.
     */
    public function __construct(
        public int $conversationId,
        public int $messageId,
        public ?int $parentId,
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('conversation.'.$this->conversationId)];
    }

    public function broadcastAs(): string
    {
        return 'MessageDeleted';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array{message_id: int, parent_id: int|null}
     */
    public function broadcastWith(): array
    {
        return [
            'message_id' => $this->messageId,
            'parent_id' => $this->parentId,
        ];
    }
}
