<?php

namespace App\Http\Requests\Chat;

use App\Models\Conversation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMessageRequest extends FormRequest
{
    /**
     * The file types members may attach.
     */
    public const AllowedFileTypes = 'jpg,jpeg,png,gif,webp,pdf,txt,md,csv,zip,doc,docx,xls,xlsx,ppt,pptx,mp4,mov,mp3';

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('post', $this->route('conversation'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Conversation $conversation */
        $conversation = $this->route('conversation');

        return [
            'body' => ['nullable', 'string', 'max:5000', 'required_without:files'],
            'files' => ['array', 'max:5'],
            'files.*' => ['file', 'max:10240', 'mimes:'.self::AllowedFileTypes],
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists('messages', 'id')
                    ->where('conversation_id', $conversation->id)
                    ->whereNull('parent_id')
                    ->whereNull('deleted_at'),
            ],
            'client_id' => ['nullable', 'string', 'max:64'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required_without' => __('Write a message or attach a file.'),
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        $body = trim((string) $this->input('body', ''));

        $this->merge(['body' => $body === '' ? null : $body]);
    }
}
