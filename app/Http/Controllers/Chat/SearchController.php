<?php

namespace App\Http\Controllers\Chat;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SearchController extends Controller
{
    /**
     * Search messages and conversations the user can see.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('q', ''));
        $user = $request->user();

        if (mb_strlen($search) < 2) {
            return Inertia::render('search', ['query' => $search, 'messages' => [], 'conversations' => []]);
        }

        $like = '%'.addcslashes($search, '%_\\').'%';
        $memberConversationIds = $user->memberships()->select('conversation_id');

        $messages = Message::query()
            ->whereIn('conversation_id', $memberConversationIds)
            ->where('body', 'like', $like)
            ->with(['user:id,name,email,avatar_path', 'conversation.members:id,name,email,avatar_path'])
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(fn (Message $message): array => [
                'id' => $message->id,
                'parent_id' => $message->parent_id,
                'body' => $message->body,
                'user' => $message->user?->toSummary(),
                'created_at' => $message->created_at?->toIso8601String(),
                'conversation' => [
                    'id' => $message->conversation->id,
                    'type' => $message->conversation->type->value,
                    'name' => $message->conversation->displayNameFor($user),
                ],
            ]);

        $conversations = Conversation::query()
            ->where(fn (Builder $query) => $query
                ->whereIn('id', $memberConversationIds)
                ->orWhere(fn (Builder $query) => $query->publicChannels()))
            ->where(fn (Builder $query) => $query
                ->where('name', 'like', $like)
                ->orWhereHas('members', fn (Builder $members) => $members
                    ->where('users.id', '!=', $user->id)
                    ->where('name', 'like', $like)))
            ->with('members:id,name,email,avatar_path')
            ->limit(20)
            ->get();

        return Inertia::render('search', [
            'query' => $search,
            'messages' => $messages,
            'conversations' => ConversationResource::collection($conversations)->resolve($request),
        ]);
    }
}
