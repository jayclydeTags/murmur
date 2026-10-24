<?php

namespace App\Http\Controllers\Chat;

use App\Enums\ConversationRole;
use App\Enums\ConversationType;
use App\Events\ConversationActivity;
use App\Events\ConversationUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\StoreConversationRequest;
use App\Http\Requests\Chat\UpdateConversationRequest;
use App\Http\Resources\ConversationResource;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageReport;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ConversationController extends Controller
{
    /**
     * How many messages to load per page of history.
     */
    public const MessagesPerPage = 40;

    /**
     * Create a group chat or channel.
     */
    public function store(StoreConversationRequest $request): RedirectResponse
    {
        $user = $request->user();
        $type = ConversationType::from($request->validated('type'));

        $conversation = DB::transaction(function () use ($request, $user, $type): Conversation {
            $conversation = Conversation::create([
                'type' => $type,
                'name' => $request->validated('name'),
                'description' => $request->validated('description'),
                'is_private' => $type === ConversationType::Group || $request->validated('is_private'),
                'created_by' => $user->id,
                'last_message_at' => now(),
            ]);

            $conversation->members()->attach($user->id, ['role' => ConversationRole::Owner->value]);

            $requestedIds = array_map('intval', Arr::wrap($request->validated('member_ids', [])));
            $memberIds = array_values(array_diff($requestedIds, [$user->id]));

            $conversation->members()->syncWithPivotValues($memberIds, ['role' => ConversationRole::Member->value], false);

            return $conversation;
        });

        $invitedIds = $conversation->memberships()->where('user_id', '!=', $user->id)->pluck('user_id')->all();

        if ($invitedIds !== []) {
            ConversationActivity::dispatch(
                $invitedIds,
                $conversation->id,
                ConversationActivity::KindAdded,
                $conversation->type->value,
                $conversation->name,
                $user->toSummary(),
            );
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':name created.', ['name' => $conversation->name])]);

        return to_route('conversations.show', $conversation);
    }

    /**
     * Show a conversation with its most recent messages.
     */
    public function show(Request $request, Conversation $conversation): Response
    {
        Gate::authorize('view', $conversation);

        $user = $request->user();
        $conversation->load('members:id,name,email,avatar_path');
        $membership = $conversation->membershipFor($user);

        $page = $conversation->messages()
            ->whereNull('parent_id')
            ->with(Message::displayRelations())
            ->withCount('replies')
            ->withMax('replies', 'created_at')
            ->orderByDesc('id')
            ->cursorPaginate(self::MessagesPerPage);

        $pinned = $conversation->messages()
            ->whereNotNull('pinned_at')
            ->with(Message::displayRelations())
            ->latest('pinned_at')
            ->limit(25)
            ->get();

        $canModerate = $user->can('moderate', $conversation);

        return Inertia::render('conversations/show', [
            'conversation' => (new ConversationResource($conversation))->resolve($request),
            'membership' => $membership ? [
                'role' => $membership->role->value,
                'is_muted' => $membership->muted_at !== null,
                'is_archived' => $membership->archived_at !== null,
                'last_read_message_id' => $membership->last_read_message_id,
            ] : null,
            'members' => $conversation->members
                ->sortBy(fn (User $member): string => strtolower($member->name))
                ->map(fn (User $member): array => [
                    ...$member->toSummary(),
                    'role' => $member->membership->role->value,
                    'last_read_message_id' => $member->membership->last_read_message_id,
                ])
                ->values(),
            'messages' => MessageResource::collection($page->getCollection()->reverse()->values())->resolve($request),
            'nextCursor' => $page->nextCursor()?->encode(),
            'pinned' => MessageResource::collection($pinned)->resolve($request),
            'reports' => $canModerate ? $this->openReports($conversation) : [],
            'can' => [
                'post' => $user->can('post', $conversation),
                'update' => $user->can('update', $conversation),
                'moderate' => $canModerate,
                'addMembers' => $user->can('addMembers', $conversation),
                'join' => $user->can('join', $conversation),
                'leave' => $user->can('leave', $conversation),
                'changeRoles' => ! $conversation->isDirect() && $membership?->role === ConversationRole::Owner,
            ],
        ]);
    }

    /**
     * Rename a conversation, change its avatar, or lock it to read-only.
     */
    public function update(UpdateConversationRequest $request, Conversation $conversation): RedirectResponse
    {
        $conversation->fill($request->safe()->only(['name', 'description', 'is_read_only']));

        if ($request->hasFile('avatar')) {
            if ($conversation->avatar_path !== null) {
                Storage::disk('public')->delete($conversation->avatar_path);
            }

            $conversation->avatar_path = $request->file('avatar')->store('conversation-avatars', 'public') ?: null;
        }

        $conversation->save();

        ConversationUpdated::dispatch($conversation->id);
        ConversationActivity::dispatch(
            $conversation->memberships()->pluck('user_id')->all(),
            $conversation->id,
            ConversationActivity::KindUpdated,
            $conversation->type->value,
            $conversation->name,
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Conversation updated.')]);

        return back();
    }

    /**
     * The unresolved reports moderators need to review.
     *
     * @return array<int, array<string, mixed>>
     */
    private function openReports(Conversation $conversation): array
    {
        return MessageReport::query()
            ->whereNull('resolved_at')
            ->whereHas('message', fn ($query) => $query->where('conversation_id', $conversation->id))
            ->with(['reporter:id,name,email,avatar_path', 'message' => fn ($query) => $query->with(Message::displayRelations())])
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn (MessageReport $report): array => [
                'id' => $report->id,
                'reason' => $report->reason,
                'reporter' => $report->reporter->toSummary(),
                'message' => (new MessageResource($report->message))->resolve(),
                'created_at' => $report->created_at?->toIso8601String(),
            ])
            ->all();
    }
}
