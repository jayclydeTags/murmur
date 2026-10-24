<?php

namespace App\Http\Controllers\Chat;

use App\Events\MessageRead;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class MessageReadController extends Controller
{
    /**
     * Record how far the current user has read and let everyone else know.
     */
    public function store(Request $request, Conversation $conversation): Response
    {
        $user = $request->user();
        $membership = $conversation->membershipFor($user);

        abort_if($membership === null, 403);

        $validated = $request->validate([
            'message_id' => ['required', 'integer', Rule::exists('messages', 'id')->where('conversation_id', $conversation->id)],
        ]);

        $messageId = (int) $validated['message_id'];

        if ($messageId > (int) $membership->last_read_message_id) {
            $membership->update(['last_read_message_id' => $messageId]);

            MessageRead::dispatch($conversation->id, $user->id, $messageId);
        }

        $user->unreadNotifications()
            ->where('data->conversation_id', $conversation->id)
            ->update(['read_at' => now()]);

        return response()->noContent();
    }
}
