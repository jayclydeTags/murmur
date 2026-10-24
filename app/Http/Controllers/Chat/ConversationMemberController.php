<?php

namespace App\Http\Controllers\Chat;

use App\Enums\ConversationRole;
use App\Events\ConversationActivity;
use App\Events\ConversationUpdated;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ConversationMemberController extends Controller
{
    /**
     * Add people to a group chat or channel.
     */
    public function store(Request $request, Conversation $conversation): RedirectResponse
    {
        Gate::authorize('addMembers', $conversation);

        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1', 'max:100'],
            'user_ids.*' => ['integer', 'distinct', Rule::exists('users', 'id')],
        ]);

        $existingIds = $conversation->memberships()->pluck('user_id')->all();
        $newIds = array_values(array_diff(array_map('intval', $validated['user_ids']), $existingIds));

        $conversation->members()->syncWithPivotValues($newIds, ['role' => ConversationRole::Member->value], false);

        if ($newIds !== []) {
            ConversationUpdated::dispatch($conversation->id);
            ConversationActivity::dispatch(
                $newIds,
                $conversation->id,
                ConversationActivity::KindAdded,
                $conversation->type->value,
                $conversation->name,
                $request->user()->toSummary(),
            );
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => trans_choice('{0} Everyone is already here.|{1} Added :count person.|[2,*] Added :count people.', count($newIds), ['count' => count($newIds)])]);

        return back();
    }

    /**
     * Change a member's role.
     */
    public function update(Request $request, Conversation $conversation, User $user): RedirectResponse
    {
        Gate::authorize('changeRole', [$conversation, $user]);

        $validated = $request->validate([
            'role' => ['required', Rule::enum(ConversationRole::class)],
        ]);

        $conversation->memberships()->where('user_id', $user->id)->update(['role' => $validated['role']]);

        ConversationUpdated::dispatch($conversation->id);

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':name is now :role.', ['name' => $user->name, 'role' => $validated['role']])]);

        return back();
    }

    /**
     * Remove a member from the conversation.
     */
    public function destroy(Request $request, Conversation $conversation, User $user): RedirectResponse
    {
        Gate::authorize('removeMember', [$conversation, $user]);

        $conversation->memberships()->where('user_id', $user->id)->delete();

        ConversationUpdated::dispatch($conversation->id);
        ConversationActivity::dispatch(
            [$user->id],
            $conversation->id,
            ConversationActivity::KindRemoved,
            $conversation->type->value,
            $conversation->name,
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Removed :name.', ['name' => $user->name])]);

        return back();
    }
}
