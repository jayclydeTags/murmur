export function TypingIndicator({ names }: { names: string[] }) {
    let text = '';

    if (names.length === 1) {
        text = `${names[0]} is typing…`;
    } else if (names.length === 2) {
        text = `${names[0]} and ${names[1]} are typing…`;
    } else if (names.length > 2) {
        text = 'Several people are typing…';
    }

    return (
        <p
            aria-live="polite"
            className="h-5 truncate px-1 text-xs text-muted-foreground"
        >
            {text && (
                <>
                    <span
                        aria-hidden
                        className="mr-1.5 inline-flex gap-0.5 align-middle"
                    >
                        {[0, 150, 300].map((delay) => (
                            <span
                                key={delay}
                                className="size-1 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
                                style={{ animationDelay: `${delay}ms` }}
                            />
                        ))}
                    </span>
                    {text}
                </>
            )}
        </p>
    );
}
