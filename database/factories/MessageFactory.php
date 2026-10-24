<?php

namespace Database\Factories;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Message>
 */
class MessageFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'conversation_id' => Conversation::factory(),
            'user_id' => User::factory(),
            'body' => fake()->sentence(),
        ];
    }

    /**
     * Indicate that the message is a reply in the given message's thread.
     */
    public function replyTo(Message $parent): static
    {
        return $this->state(fn (array $attributes) => [
            'conversation_id' => $parent->conversation_id,
            'parent_id' => $parent->id,
        ]);
    }
}
