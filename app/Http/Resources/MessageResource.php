<?php

namespace App\Http\Resources;

use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageReaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Message
 */
class MessageResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $isDeleted = $this->trashed();

        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'parent_id' => $this->parent_id,
            'body' => $isDeleted ? null : $this->body,
            'user' => $this->user?->toSummary(),
            'attachments' => $isDeleted ? [] : $this->attachments->map(fn (MessageAttachment $attachment): array => [
                'id' => $attachment->id,
                'name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size' => $attachment->size,
                'width' => $attachment->width,
                'height' => $attachment->height,
                'is_image' => $attachment->isImage(),
                'url' => route('attachments.show', $attachment),
            ])->values()->all(),
            'reactions' => $isDeleted ? [] : $this->reactions
                ->groupBy('emoji')
                ->map(fn ($reactions, string $emoji): array => [
                    'emoji' => $emoji,
                    'count' => $reactions->count(),
                    'user_ids' => $reactions->map(fn (MessageReaction $reaction): int => $reaction->user_id)->values()->all(),
                ])
                ->values()
                ->all(),
            'reply_count' => (int) ($this->replies_count ?? 0),
            'latest_reply_at' => $this->replies_max_created_at,
            'link_preview' => $isDeleted ? null : $this->link_preview,
            'is_pinned' => $this->pinned_at !== null,
            'is_edited' => $this->edited_at !== null,
            'is_deleted' => $isDeleted,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
