<?php

namespace Database\Factories;

use App\Models\Message;
use App\Models\MessageReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MessageReport>
 */
class MessageReportFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'message_id' => Message::factory(),
            'reporter_id' => User::factory(),
            'reason' => fake()->sentence(),
        ];
    }
}
