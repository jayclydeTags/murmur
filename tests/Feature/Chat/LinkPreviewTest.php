<?php

use App\Jobs\FetchLinkPreview;
use App\Models\Message;
use Illuminate\Support\Facades\Http;

test('links to private network addresses are never fetched', function (string $url) {
    Http::fake();
    $message = Message::factory()->create(['body' => "See {$url}"]);

    (new FetchLinkPreview($message))->handle();

    Http::assertNothingSent();
    expect($message->fresh()->link_preview)->toBeNull();
})->with([
    'loopback' => 'http://127.0.0.1/admin',
    'private range' => 'http://192.168.1.10/',
    'localhost' => 'http://localhost:8080/',
]);

test('the first link in a message is found without trailing punctuation', function () {
    expect(FetchLinkPreview::firstUrlIn('Read https://laravel.com/docs. Then ship.'))->toBe('https://laravel.com/docs')
        ->and(FetchLinkPreview::firstUrlIn('No links here'))->toBeNull();
});
