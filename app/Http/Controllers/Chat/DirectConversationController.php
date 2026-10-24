<?php

namespace App\Http\Controllers\Chat;

use App\Actions\Chat\OpenDirectConversation;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DirectConversationController extends Controller
{
    /**
     * Open (or start) a direct message with someone.
     */
    public function store(Request $request, OpenDirectConversation $openDirectConversation): RedirectResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')],
        ]);

        $conversation = $openDirectConversation->handle($request->user(), User::query()->whereKey($validated['user_id'])->firstOrFail());

        return to_route('conversations.show', $conversation);
    }
}
