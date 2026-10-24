<?php

namespace Database\Seeders;

use App\Enums\ConversationRole;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Illuminate\Support\Collection;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $you = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        $team = collect(['Ana Reyes', 'Ben Cruz', 'Carla Santos', 'Dev Patel'])
            ->map(fn (string $name) => User::factory()->create([
                'name' => $name,
                'email' => Str::lower(Str::before($name, ' ')).'@example.com',
            ]));

        $everyone = $team->prepend($you);

        $general = $this->channel('general', 'Company-wide announcements and chatter.', $you, $everyone);
        $this->channel('random', 'Memes, links, and everything else.', $team[1], $everyone->take(4));
        $this->channel('announcements', 'Important updates. Only admins post here.', $you, $everyone, readOnly: true);
        $this->channel('design', 'Private space for the design crew.', $team[2], collect([$team[2], $team[3], $you]), private: true);
        $this->channel('help-desk', 'Ask anything. Nobody here yet!', $team[4], collect([$team[4]]));

        $script = [
            [$team[1], 'Morning all! ☀️ Standup in 10.'],
            [$team[2], 'On my way. @Test User do you have the release notes?'],
            [$you, 'Yep, posting them after standup.'],
            [$team[3], 'Docs for the new API are here: https://laravel.com/docs/broadcasting'],
            [$team[4], 'Nice, Reverb makes this so much easier.'],
        ];

        foreach ($script as $index => [$author, $body]) {
            Message::factory()->for($general)->for($author)->create([
                'body' => $body,
                'created_at' => now()->subMinutes(30 - $index * 4),
            ]);
        }

        $general->update(['last_message_at' => now()->subMinutes(14)]);
        $general->memberships()->where('user_id', $you->id)->update(['last_read_message_id' => $general->messages()->min('id')]);

        $direct = Conversation::factory()->direct($you, $team[1])->create(['last_message_at' => now()->subMinutes(5)]);
        Message::factory()->for($direct)->for($team[1])->create(['body' => 'Hey! Got a minute to review my PR?', 'created_at' => now()->subMinutes(5)]);

        $group = Conversation::factory()->group()->create(['name' => 'Launch crew', 'last_message_at' => now()->subHour()]);
        $group->members()->attach($you->id, ['role' => ConversationRole::Owner->value]);
        $group->members()->attach([$team[2]->id, $team[3]->id], ['role' => ConversationRole::Member->value]);
        Message::factory()->for($group)->for($team[3])->create(['body' => 'T-minus 2 days 🚀', 'created_at' => now()->subHour()]);
    }

    /**
     * @param  Collection<int, User>  $members
     */
    private function channel(string $name, string $description, User $owner, $members, bool $private = false, bool $readOnly = false): Conversation
    {
        $channel = Conversation::factory()->create([
            'name' => $name,
            'description' => $description,
            'is_private' => $private,
            'is_read_only' => $readOnly,
            'created_by' => $owner->id,
            'last_message_at' => now()->subDay(),
        ]);

        $channel->members()->attach($owner->id, ['role' => ConversationRole::Owner->value]);
        $channel->members()->syncWithPivotValues(
            $members->pluck('id')->reject(fn (int $id) => $id === $owner->id)->values()->all(),
            ['role' => ConversationRole::Member->value],
            false,
        );

        return $channel;
    }
}
