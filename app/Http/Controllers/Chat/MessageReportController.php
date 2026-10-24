<?php

namespace App\Http\Controllers\Chat;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\MessageReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class MessageReportController extends Controller
{
    /**
     * Report a message to the conversation's owners and admins.
     */
    public function store(Request $request, Message $message): JsonResponse
    {
        Gate::authorize('report', $message);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $message->reports()->updateOrCreate(
            ['reporter_id' => $request->user()->id],
            ['reason' => $validated['reason'], 'resolved_at' => null, 'resolved_by' => null],
        );

        return response()->json(['message' => __('Thanks, the conversation admins will take a look.')], 201);
    }

    /**
     * Dismiss a report without deleting the message.
     */
    public function update(Request $request, MessageReport $report): RedirectResponse
    {
        Gate::authorize('moderate', $report->message->conversation);

        $report->update([
            'resolved_at' => now(),
            'resolved_by' => $request->user()->id,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Report dismissed.')]);

        return back();
    }
}
