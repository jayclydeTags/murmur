<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class UnreadMessagesDigest extends Notification
{
    use Queueable;

    /**
     * Create a new notification instance.
     *
     * @param  array<int, array{name: string, unread_count: int, url: string}>  $conversations
     */
    public function __construct(public array $conversations) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $total = array_sum(array_column($this->conversations, 'unread_count'));

        $mail = (new MailMessage)
            ->subject(trans_choice('{1} You have :count unread message|[2,*] You have :count unread messages', $total, ['count' => $total]))
            ->greeting(__('Here is what you missed'));

        foreach ($this->conversations as $conversation) {
            $mail->line(trans_choice('**:name**: :count unread message|**:name**: :count unread messages', $conversation['unread_count'], [
                'name' => $conversation['name'],
                'count' => $conversation['unread_count'],
            ]));
        }

        return $mail
            ->action(__('Open Murmur'), route('dashboard'))
            ->line(__('You can turn off this digest in your notification settings.'));
    }
}
