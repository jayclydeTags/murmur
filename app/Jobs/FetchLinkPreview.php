<?php

namespace App\Jobs;

use App\Events\MessageUpdated;
use App\Models\Message;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class FetchLinkPreview implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    private const MaxRedirects = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(public Message $message) {}

    /**
     * Find the first link in a message body.
     */
    public static function firstUrlIn(?string $body): ?string
    {
        if ($body === null || ! preg_match('~https?://[^\s<>"\']+~i', $body, $matches)) {
            return null;
        }

        return rtrim($matches[0], '.,!?;:)');
    }

    /**
     * Fetch the page's Open Graph metadata and attach it to the message.
     */
    public function handle(): void
    {
        $url = self::firstUrlIn($this->message->body);

        if ($url === null || $this->message->trashed()) {
            return;
        }

        $html = $this->fetchHtml($url);

        if ($html === null) {
            return;
        }

        $preview = $this->parse($url, $html);

        if ($preview['title'] === null && $preview['description'] === null) {
            return;
        }

        $this->message->update(['link_preview' => $preview]);

        MessageUpdated::dispatch($this->message);
    }

    /**
     * Download the page, following a few redirects while refusing private network targets.
     */
    private function fetchHtml(string $url): ?string
    {
        for ($redirects = 0; $redirects <= self::MaxRedirects; $redirects++) {
            if (! self::isPublicUrl($url)) {
                return null;
            }

            try {
                $response = Http::timeout(5)
                    ->withoutRedirecting()
                    ->withHeaders(['Accept' => 'text/html', 'User-Agent' => 'MurmurBot/1.0 (+link previews)'])
                    ->get($url);
            } catch (ConnectionException) {
                return null;
            }

            if ($response->redirect() && $response->header('Location') !== '') {
                $url = (string) Str::of($response->header('Location'))->whenStartsWith('/', fn ($location) => $location->prepend(self::origin($url)));

                continue;
            }

            if (! $response->successful() || ! Str::contains($response->header('Content-Type'), 'html')) {
                return null;
            }

            return Str::limit($response->body(), 500_000, '');
        }

        return null;
    }

    /**
     * Only allow http(s) URLs that resolve to public addresses.
     */
    public static function isPublicUrl(string $url): bool
    {
        $parts = parse_url($url);

        if (! isset($parts['scheme'], $parts['host']) || ! in_array(strtolower($parts['scheme']), ['http', 'https'], true)) {
            return false;
        }

        $addresses = gethostbynamel($parts['host']) ?: [];

        if ($addresses === []) {
            return false;
        }

        foreach ($addresses as $address) {
            if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                return false;
            }
        }

        return true;
    }

    private static function origin(string $url): string
    {
        $parts = parse_url($url);

        if ($parts === false || ! isset($parts['scheme'], $parts['host'])) {
            return '';
        }

        return $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
    }

    /**
     * Extract the preview fields from the page's markup.
     *
     * @return array{url: string, title: string|null, description: string|null, image: string|null, site_name: string|null}
     */
    private function parse(string $url, string $html): array
    {
        $meta = function (string $property) use ($html): ?string {
            $pattern = '~<meta[^>]+(?:property|name)=["\']'.preg_quote($property, '~').'["\'][^>]*content=["\']([^"\']*)["\']~i';
            $reversed = '~<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']'.preg_quote($property, '~').'["\']~i';

            if (preg_match($pattern, $html, $matches) || preg_match($reversed, $html, $matches)) {
                $value = trim(html_entity_decode($matches[1], ENT_QUOTES | ENT_HTML5));

                return $value === '' ? null : Str::limit($value, 300);
            }

            return null;
        };

        $title = $meta('og:title');

        if ($title === null && preg_match('~<title[^>]*>(.*?)</title>~is', $html, $matches)) {
            $title = Str::limit(trim(html_entity_decode($matches[1], ENT_QUOTES | ENT_HTML5)), 300) ?: null;
        }

        $image = $meta('og:image');

        return [
            'url' => $url,
            'title' => $title,
            'description' => $meta('og:description') ?? $meta('description'),
            'image' => $image !== null && Str::startsWith($image, ['http://', 'https://']) ? $image : null,
            'site_name' => $meta('og:site_name') ?? (parse_url($url, PHP_URL_HOST) ?: null),
        ];
    }
}
