<?php

namespace App\Http\Controllers\Chat;

use App\Actions\Chat\SendMessage;
use App\Events\MessageDeleted;
use App\Events\MessageUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\StoreMessageRequest;
use App\Http\Resources\MessageResource;
use App\Jobs\FetchLinkPreview;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class MessageController extends Controller
{
    /**
     * Load an older page of history using the cursor from the previous page.
     */
    public function index(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $page = $conversation->messages()
            ->whereNull('parent_id')
            ->with(Message::displayRelations())
            ->withCount('replies')
            ->withMax('replies', 'created_at')
            ->orderByDesc('id')
            ->cursorPaginate(ConversationController::MessagesPerPage);

        return response()->json([
            'data' => MessageResource::collection($page->getCollection()->reverse()->values())->resolve($request),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]);
    }

    /**
     * Send a message or a thread reply.
     */
    public function store(StoreMessageRequest $request, Conversation $conversation, SendMessage $sendMessage): JsonResponse
    {
        $parentId = $request->validated('parent_id');

        $message = $sendMessage->handle(
            $request->user(),
            $conversation,
            $request->validated('body'),
            $request->file('files', []),
            $parentId ? $conversation->messages()->whereKey($parentId)->firstOrFail() : null,
            $request->validated('client_id'),
        );

        return (new MessageResource($message->loadForDisplay()))
            ->additional(['client_id' => $request->validated('client_id')])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Edit the body of your own message.
     */
    public function update(Request $request, Message $message): MessageResource
    {
        Gate::authorize('update', $message);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $body = trim($validated['body']);
        $linkChanged = FetchLinkPreview::firstUrlIn($body) !== FetchLinkPreview::firstUrlIn($message->body);

        $message->fill(['body' => $body]);

        if ($message->isDirty('body')) {
            $message->edited_at = now();
        }

        if ($linkChanged) {
            $message->link_preview = null;
        }

        $message->save();

        MessageUpdated::dispatch($message);

        if ($linkChanged && FetchLinkPreview::firstUrlIn($body) !== null) {
            FetchLinkPreview::dispatch($message);
        }

        return new MessageResource($message->loadForDisplay());
    }

    /**
     * Delete a message; authors delete their own, owners and admins can delete any.
     */
    public function destroy(Request $request, Message $message): Response
    {
        Gate::authorize('delete', $message);

        $message->forceFill(['deleted_by' => $request->user()->id])->save();
        $message->delete();

        $message->reports()->whereNull('resolved_at')->update([
            'resolved_at' => now(),
            'resolved_by' => $request->user()->id,
        ]);

        MessageDeleted::dispatch($message->conversation_id, $message->id, $message->parent_id);

        if ($message->parent !== null) {
            MessageUpdated::dispatch($message->parent);
        }

        return response()->noContent();
    }
}
