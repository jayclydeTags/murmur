<?php

namespace App\Http\Controllers\Chat;

use App\Http\Controllers\Controller;
use App\Models\MessageAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    /**
     * Serve an attachment to people who can see its conversation.
     */
    public function show(Request $request, MessageAttachment $attachment): StreamedResponse
    {
        $message = $attachment->message()->withTrashed()->firstOrFail();

        Gate::authorize('view', $message->conversation);

        abort_if($message->trashed(), 404);

        $headers = [
            'Content-Type' => $attachment->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=3600',
        ];

        $disposition = $attachment->isImage() && ! $request->boolean('download') ? 'inline' : 'attachment';

        return Storage::disk($attachment->disk)->response($attachment->path, $attachment->original_name, $headers, $disposition);
    }
}
