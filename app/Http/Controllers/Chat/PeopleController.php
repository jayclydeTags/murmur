<?php

namespace App\Http\Controllers\Chat;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PeopleController extends Controller
{
    /**
     * Find people in the workspace by name or email.
     */
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $escaped = addcslashes($search, '%_\\');

        $people = User::query()
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('name', 'like', '%'.$escaped.'%')
                ->orWhere('email', 'like', '%'.$escaped.'%')))
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'email', 'avatar_path'])
            ->map(fn (User $user): array => $user->toSummary());

        return response()->json(['data' => $people]);
    }
}
