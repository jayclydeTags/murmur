<?php

namespace App\Http\Controllers\Chat;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ChannelDirectoryController extends Controller
{
    /**
     * Browse the public channels anyone in the workspace can join.
     */
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $userId = $request->user()->id;

        $channels = Conversation::query()
            ->publicChannels()
            ->when($search !== '', fn ($query) => $query->where('name', 'like', '%'.addcslashes($search, '%_\\').'%'))
            ->withCount('memberships')
            ->withExists(['memberships as is_member' => fn ($query) => $query->where('user_id', $userId)])
            ->orderByDesc('memberships_count')
            ->orderBy('name')
            ->limit(100)
            ->get()
            ->map(fn (Conversation $channel): array => [
                'id' => $channel->id,
                'name' => $channel->name,
                'description' => $channel->description,
                'is_read_only' => $channel->is_read_only,
                'member_count' => $channel->memberships_count,
                'is_member' => (bool) $channel->getAttribute('is_member'),
            ]);

        return Inertia::render('channels/index', [
            'channels' => $channels,
            'search' => $search,
        ]);
    }
}
