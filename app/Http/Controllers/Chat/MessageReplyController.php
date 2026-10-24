<?php

namespace App\Http\Controllers\Chat;

use App\Http\Controllers\Controller;
use App\Http\Resources\MessageResource;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MessageReplyController extends Controller
{
    /**
     * The thread for a message: the parent and its replies, oldest first.
     */
    public function index(Request $request, Message $message): JsonResponse
    {
        Gate::authorize('view', $message->conversation);

        abort_if($message->parent_id !== null, 404);

        $replies = $message->replies()
            ->with(Message::displayRelations())
            ->oldest('id')
            ->limit(500)
            ->get();

        return response()->json([
            'parent' => (new MessageResource($message->loadForDisplay()))->resolve($request),
            'replies' => MessageResource::collection($replies)->resolve($request),
        ]);
    }
}
