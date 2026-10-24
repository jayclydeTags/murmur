<?php

namespace App\Http\Requests\Chat;

use App\Enums\ConversationType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreConversationRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in([ConversationType::Group->value, ConversationType::Channel->value])],
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_private' => ['boolean'],
            'member_ids' => ['array', 'max:100'],
            'member_ids.*' => ['integer', 'distinct', Rule::exists('users', 'id')],
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'is_private' => $this->boolean('is_private'),
            'member_ids' => $this->input('member_ids', []),
        ]);
    }
}
