<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    /**
     * Show the user's notification settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/notifications', [
            'emailDigestEnabled' => $request->user()->email_digest_enabled,
        ]);
    }

    /**
     * Update the user's notification settings.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email_digest_enabled' => ['required', 'boolean'],
        ]);

        $request->user()->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Notification settings saved.')]);

        return to_route('notifications.edit');
    }
}
