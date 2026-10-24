<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\MessageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $conversation_id
 * @property int|null $user_id
 * @property int|null $parent_id
 * @property string|null $body
 * @property array{url: string, title: string|null, description: string|null, image: string|null, site_name: string|null}|null $link_preview
 * @property CarbonImmutable|null $edited_at
 * @property CarbonImmutable|null $pinned_at
 * @property int|null $pinned_by
 * @property int|null $deleted_by
 * @property CarbonImmutable|null $deleted_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read int|null $replies_count
 * @property-read string|null $replies_max_created_at
 */
#[Fillable(['conversation_id', 'user_id', 'parent_id', 'body', 'link_preview', 'edited_at', 'pinned_at', 'pinned_by', 'deleted_by'])]
class Message extends Model
{
    /** @use HasFactory<MessageFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'link_preview' => 'array',
            'edited_at' => 'datetime',
            'pinned_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'parent_id');
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function replies(): HasMany
    {
        return $this->hasMany(Message::class, 'parent_id');
    }

    /**
     * @return HasMany<MessageAttachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class);
    }

    /**
     * @return HasMany<MessageReaction, $this>
     */
    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
    }

    /**
     * @return HasMany<MessageReport, $this>
     */
    public function reports(): HasMany
    {
        return $this->hasMany(MessageReport::class);
    }

    /**
     * The relations a message needs to be rendered in the UI.
     *
     * @return array<int|string, mixed>
     */
    public static function displayRelations(): array
    {
        return [
            'user:id,name,email,avatar_path',
            'attachments',
            'reactions:id,message_id,user_id,emoji',
        ];
    }

    /**
     * Load everything needed to render this message.
     */
    public function loadForDisplay(): static
    {
        return $this->load(static::displayRelations())
            ->loadCount('replies')
            ->loadMax('replies', 'created_at');
    }
}
