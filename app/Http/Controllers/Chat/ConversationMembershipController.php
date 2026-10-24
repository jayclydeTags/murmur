<?php

namespace App\Http\Controllers\Chat;

use App\Enums\ConversationRole;
use App\Events\ConversationUpdated;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ConversationMembershipController extends Controller
{
    /**
     * Join a public channel.
     */
    public function store(Request $request, Conversation $conversation): RedirectResponse
    {
        Gate::authorize('join', $conversation);

        $conversation->members()->attach($request->user()->id, ['role' => ConversationRole::Member->value]);

        ConversationUpdated::dispatch($conversation->id);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('You joined #:name.', ['name' => $conversation->name])]);

        return to_route('conversations.show', $conversation);
    }

    /**
     * Leave a group chat or channel, handing ownership on if needed.
     */
    public function destroy(Request $request, Conversation $conversation): RedirectResponse
    {
        Gate::authorize('leave', $conversation);

        $user = $request->user();

        DB::transaction(function () use ($conversation, $user) {
            $conversation->memberships()->where('user_id', $user->id)->delete();

            $hasOwner = $conversation->memberships()->where('role', ConversationRole::Owner)->exists();

            if (! $hasOwner) {
                $conversation->memberships()
                    ->orderByRaw("case role when 'admin' then 0 else 1 end")
                    ->oldest('id')
                    ->first()
                    ?->update(['role' => ConversationRole::Owner]);
            }
        });

        ConversationUpdated::dispatch($conversation->id);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('You left :name.', ['name' => $conversation->name])]);

        return to_route('dashboard');
    }
}
