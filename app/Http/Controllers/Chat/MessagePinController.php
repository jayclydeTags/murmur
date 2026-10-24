<?php

namespace App\Http\Controllers\Chat;

use App\Events\MessageUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\MessageResource;
use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MessagePinController extends Controller
{
    /**
     * Pin a message to the conversation.
     */
    public function store(Request $request, Message $message): MessageResource
    {
        return $this->setPinned($request, $message, true);
    }

    /**
     * Unpin a message.
     */
    public function destroy(Request $request, Message $message): MessageResource
    {
        return $this->setPinned($request, $message, false);
    }

    private function setPinned(Request $request, Message $message, bool $pinned): MessageResource
    {
        Gate::authorize('participate', $message->conversation);

        abort_if($message->trashed() || $message->parent_id !== null, 404);

        $message->forceFill([
            'pinned_at' => $pinned ? now() : null,
            'pinned_by' => $pinned ? $request->user()->id : null,
        ])->save();

        MessageUpdated::dispatch($message);

        return new MessageResource($message->loadForDisplay());
    }
}
