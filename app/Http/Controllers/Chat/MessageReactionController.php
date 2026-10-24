<?php

namespace App\Http\Controllers\Chat;

use App\Events\MessageUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\MessageResource;
use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MessageReactionController extends Controller
{
    /**
     * Toggle the current user's emoji reaction on a message.
     */
    public function store(Request $request, Message $message): MessageResource
    {
        Gate::authorize('participate', $message->conversation);

        abort_if($message->trashed(), 404);

        $validated = $request->validate([
            'emoji' => ['required', 'string', 'max:32', 'not_regex:/[\s<>]/u'],
        ]);

        $reaction = $message->reactions()
            ->where('user_id', $request->user()->id)
            ->where('emoji', $validated['emoji'])
            ->first();

        if ($reaction !== null) {
            $reaction->delete();
        } else {
            $message->reactions()->create([
                'user_id' => $request->user()->id,
                'emoji' => $validated['emoji'],
            ]);
        }

        MessageUpdated::dispatch($message);

        return new MessageResource($message->loadForDisplay());
    }
}
