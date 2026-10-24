<?php

namespace App\Http\Controllers\Chat;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ConversationPreferenceController extends Controller
{
    /**
     * Mute or archive a conversation for the current user.
     */
    public function update(Request $request, Conversation $conversation): RedirectResponse
    {
        $membership = $conversation->membershipFor($request->user());

        abort_if($membership === null, 403);

        $validated = $request->validate([
            'muted' => ['sometimes', 'boolean'],
            'archived' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('muted', $validated)) {
            $membership->muted_at = $validated['muted'] ? now() : null;
        }

        if (array_key_exists('archived', $validated)) {
            $membership->archived_at = $validated['archived'] ? now() : null;
        }

        $membership->save();

        $message = match (true) {
            array_key_exists('archived', $validated) => $validated['archived'] ? __('Conversation archived.') : __('Conversation restored.'),
            default => $validated['muted'] ?? false ? __('Conversation muted.') : __('Conversation unmuted.'),
        };

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
