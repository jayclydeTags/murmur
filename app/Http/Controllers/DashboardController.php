<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Show recent mentions and channels worth joining.
     */
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        $mentions = $user->notifications()
            ->latest()
            ->limit(15)
            ->get()
            ->map(fn (DatabaseNotification $notification): array => [
                'id' => $notification->id,
                'data' => $notification->data,
                'read' => $notification->read_at !== null,
                'created_at' => $notification->created_at?->toIso8601String(),
            ]);

        $suggestedChannels = Conversation::query()
            ->publicChannels()
            ->whereDoesntHave('memberships', fn ($query) => $query->where('user_id', $user->id))
            ->withCount('memberships')
            ->orderByDesc('memberships_count')
            ->limit(5)
            ->get()
            ->map(fn (Conversation $channel): array => [
                'id' => $channel->id,
                'name' => $channel->name,
                'description' => $channel->description,
                'member_count' => $channel->memberships_count,
            ]);

        return Inertia::render('dashboard', [
            'mentions' => $mentions,
            'suggestedChannels' => $suggestedChannels,
        ]);
    }
}
