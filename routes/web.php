<?php

use App\Http\Controllers\Chat\AttachmentController;
use App\Http\Controllers\Chat\ChannelDirectoryController;
use App\Http\Controllers\Chat\ConversationController;
use App\Http\Controllers\Chat\ConversationMemberController;
use App\Http\Controllers\Chat\ConversationMembershipController;
use App\Http\Controllers\Chat\ConversationPreferenceController;
use App\Http\Controllers\Chat\DirectConversationController;
use App\Http\Controllers\Chat\MessageController;
use App\Http\Controllers\Chat\MessagePinController;
use App\Http\Controllers\Chat\MessageReactionController;
use App\Http\Controllers\Chat\MessageReadController;
use App\Http\Controllers\Chat\MessageReplyController;
use App\Http\Controllers\Chat\MessageReportController;
use App\Http\Controllers\Chat\NotificationReadController;
use App\Http\Controllers\Chat\PeopleController;
use App\Http\Controllers\Chat\SearchController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::get('channels', [ChannelDirectoryController::class, 'index'])->name('channels.index');
    Route::get('search', [SearchController::class, 'index'])->name('search');
    Route::get('people', [PeopleController::class, 'index'])->name('people.index');

    Route::post('conversations', [ConversationController::class, 'store'])->name('conversations.store');
    Route::post('conversations/direct', [DirectConversationController::class, 'store'])->name('conversations.direct.store');
    Route::get('conversations/{conversation}', [ConversationController::class, 'show'])->name('conversations.show');
    Route::patch('conversations/{conversation}', [ConversationController::class, 'update'])->name('conversations.update');

    Route::post('conversations/{conversation}/join', [ConversationMembershipController::class, 'store'])->name('conversations.join');
    Route::delete('conversations/{conversation}/leave', [ConversationMembershipController::class, 'destroy'])->name('conversations.leave');
    Route::patch('conversations/{conversation}/preferences', [ConversationPreferenceController::class, 'update'])->name('conversations.preferences.update');

    Route::post('conversations/{conversation}/members', [ConversationMemberController::class, 'store'])->name('conversations.members.store');
    Route::patch('conversations/{conversation}/members/{user}', [ConversationMemberController::class, 'update'])->name('conversations.members.update');
    Route::delete('conversations/{conversation}/members/{user}', [ConversationMemberController::class, 'destroy'])->name('conversations.members.destroy');

    Route::get('conversations/{conversation}/messages', [MessageController::class, 'index'])->name('conversations.messages.index');
    Route::post('conversations/{conversation}/messages', [MessageController::class, 'store'])
        ->middleware('throttle:chat-messages')
        ->name('conversations.messages.store');
    Route::post('conversations/{conversation}/read', [MessageReadController::class, 'store'])->name('conversations.read');

    Route::patch('messages/{message}', [MessageController::class, 'update'])->name('messages.update');
    Route::delete('messages/{message}', [MessageController::class, 'destroy'])->name('messages.destroy');
    Route::get('messages/{message}/replies', [MessageReplyController::class, 'index'])->name('messages.replies.index');
    Route::post('messages/{message}/reactions', [MessageReactionController::class, 'store'])->name('messages.reactions.store');
    Route::post('messages/{message}/pin', [MessagePinController::class, 'store'])->name('messages.pin.store');
    Route::delete('messages/{message}/pin', [MessagePinController::class, 'destroy'])->name('messages.pin.destroy');
    Route::post('messages/{message}/reports', [MessageReportController::class, 'store'])->name('messages.reports.store');
    Route::patch('reports/{report}', [MessageReportController::class, 'update'])->name('reports.update');

    Route::get('attachments/{attachment}', [AttachmentController::class, 'show'])->name('attachments.show');

    Route::post('notifications/read', [NotificationReadController::class, 'store'])->name('notifications.read');
});

require __DIR__.'/settings.php';
