<?php

namespace App\Models;

use App\Enums\ConversationRole;
use App\Enums\ConversationType;
use Carbon\CarbonImmutable;
use Database\Factories\ConversationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property ConversationType $type
 * @property string|null $name
 * @property string|null $description
 * @property string|null $avatar_path
 * @property bool $is_private
 * @property bool $is_read_only
 * @property string|null $direct_key
 * @property int|null $created_by
 * @property CarbonImmutable|null $last_message_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['type', 'name', 'description', 'avatar_path', 'is_private', 'is_read_only', 'direct_key', 'created_by', 'last_message_at'])]
class Conversation extends Model
{
    /** @use HasFactory<ConversationFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => ConversationType::class,
            'is_private' => 'boolean',
            'is_read_only' => 'boolean',
            'last_message_at' => 'datetime',
        ];
    }

    /**
     * Build the key that uniquely identifies a direct conversation between two users.
     */
    public static function directKeyFor(User $first, User $second): string
    {
        $ids = [$first->id, $second->id];
        sort($ids);

        return implode(':', $ids);
    }

    /**
     * @return BelongsToMany<User, $this, ConversationMember, 'membership'>
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'conversation_members')
            ->using(ConversationMember::class)
            ->as('membership')
            ->withPivot(['id', 'role', 'last_read_message_id', 'muted_at', 'archived_at'])
            ->withTimestamps();
    }

    /**
     * @return HasMany<ConversationMember, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(ConversationMember::class);
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope the query to conversations the given user belongs to.
     *
     * @param  Builder<Conversation>  $query
     */
    public function scopeWhereMember(Builder $query, User $user): void
    {
        $query->whereHas('memberships', fn (Builder $memberships) => $memberships->where('user_id', $user->id));
    }

    /**
     * Scope the query to public channels anyone in the workspace can join.
     *
     * @param  Builder<Conversation>  $query
     */
    public function scopePublicChannels(Builder $query): void
    {
        $query->where('type', ConversationType::Channel)->where('is_private', false);
    }

    /**
     * The conversations shown in a user's sidebar, with their unread counts and preferences.
     *
     * @return Collection<int, Conversation>
     */
    public static function sidebarFor(User $user): Collection
    {
        $unreadCount = Message::query()
            ->selectRaw('count(*)')
            ->whereColumn('messages.conversation_id', 'conversations.id')
            ->whereNull('messages.parent_id')
            ->where(fn (Builder $query) => $query->whereNull('messages.user_id')->orWhere('messages.user_id', '!=', $user->id))
            ->whereRaw('messages.id > coalesce(membership.last_read_message_id, 0)');

        $conversations = Conversation::query()
            ->join('conversation_members as membership', function ($join) use ($user) {
                $join->on('membership.conversation_id', '=', 'conversations.id')
                    ->where('membership.user_id', '=', $user->id);
            })
            ->select('conversations.*', 'membership.muted_at as member_muted_at', 'membership.archived_at as member_archived_at')
            ->selectSub($unreadCount, 'unread_count')
            ->orderByDesc('conversations.last_message_at')
            ->orderByDesc('conversations.id')
            ->get();

        $conversations->filter(fn (Conversation $conversation): bool => $conversation->isDirect())
            ->load('members:id,name,email,avatar_path');

        return $conversations;
    }

    public function membershipFor(User $user): ?ConversationMember
    {
        return $this->memberships()->where('user_id', $user->id)->first();
    }

    public function hasMember(User $user): bool
    {
        return $this->memberships()->where('user_id', $user->id)->exists();
    }

    public function roleFor(User $user): ?ConversationRole
    {
        return $this->membershipFor($user)?->role;
    }

    public function isDirect(): bool
    {
        return $this->type === ConversationType::Direct;
    }

    public function isPublicChannel(): bool
    {
        return $this->type === ConversationType::Channel && ! $this->is_private;
    }

    /**
     * The private broadcast channel name for this conversation.
     */
    public function broadcastChannelName(): string
    {
        return 'conversation.'.$this->id;
    }

    /**
     * The name shown to the given user, using the other participant for direct messages.
     */
    public function displayNameFor(User $user): string
    {
        if (! $this->isDirect()) {
            return (string) $this->name;
        }

        $other = $this->members->firstWhere('id', '!=', $user->id) ?? $user;

        return $other->is($user) ? $user->name.' (you)' : $other->name;
    }

    /**
     * The avatar shown to the given user, using the other participant for direct messages.
     */
    public function avatarFor(User $user): ?string
    {
        if ($this->isDirect()) {
            return ($this->members->firstWhere('id', '!=', $user->id) ?? $user)->avatar;
        }

        return $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null;
    }
}
