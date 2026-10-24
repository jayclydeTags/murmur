<?php

namespace App\Http\Resources;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Conversation
 */
class ConversationResource extends JsonResource
{
    /**
     * Transform the resource into an array for the given viewer.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var User $viewer */
        $viewer = $request->user();

        $data = [
            'id' => $this->id,
            'type' => $this->type->value,
            'name' => $this->displayNameFor($viewer),
            'description' => $this->description,
            'avatar' => $this->avatarFor($viewer),
            'is_private' => $this->is_private,
            'is_read_only' => $this->is_read_only,
            'last_message_at' => $this->last_message_at?->toIso8601String(),
        ];

        if ($this->isDirect()) {
            $data['direct_user_id'] = ($this->members->firstWhere('id', '!=', $viewer->id) ?? $viewer)->id;
        }

        if (array_key_exists('unread_count', $this->getAttributes())) {
            $data['unread_count'] = (int) $this->getAttribute('unread_count');
            $data['is_muted'] = $this->getAttribute('member_muted_at') !== null;
            $data['is_archived'] = $this->getAttribute('member_archived_at') !== null;
        }

        return $data;
    }
}
