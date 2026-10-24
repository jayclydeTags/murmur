<?php

namespace Database\Factories;

use App\Enums\ConversationRole;
use App\Enums\ConversationType;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Conversation>
 */
class ConversationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => ConversationType::Channel,
            'name' => fake()->unique()->slug(2),
            'description' => fake()->sentence(),
            'is_private' => false,
            'is_read_only' => false,
        ];
    }

    /**
     * Indicate that the conversation is an invite-only channel.
     */
    public function privateChannel(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => ConversationType::Channel,
            'is_private' => true,
        ]);
    }

    /**
     * Indicate that the conversation is a named group chat.
     */
    public function group(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => ConversationType::Group,
            'name' => fake()->words(2, true),
            'description' => null,
            'is_private' => true,
        ]);
    }

    /**
     * Indicate that the conversation is a direct message between two users.
     */
    public function direct(User $first, User $second): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => ConversationType::Direct,
            'name' => null,
            'description' => null,
            'is_private' => true,
            'direct_key' => Conversation::directKeyFor($first, $second),
        ])->afterCreating(function (Conversation $conversation) use ($first, $second) {
            $conversation->members()->syncWithPivotValues(
                array_unique([$first->id, $second->id]),
                ['role' => ConversationRole::Member->value],
            );
        });
    }

    /**
     * Indicate that only admins may post in the conversation.
     */
    public function readOnly(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_read_only' => true,
        ]);
    }

    /**
     * Add the given user to the conversation with a role.
     */
    public function withMember(User $user, ConversationRole $role = ConversationRole::Member): static
    {
        return $this->afterCreating(function (Conversation $conversation) use ($user, $role) {
            $conversation->members()->attach($user->id, ['role' => $role->value]);
        });
    }
}
