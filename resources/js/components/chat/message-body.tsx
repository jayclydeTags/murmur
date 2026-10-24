import { Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Renders a message body with clickable links and highlighted @mentions.
 */
export function MessageBody({
    body,
    memberNames,
    currentUserName,
    className,
}: {
    body: string;
    memberNames: string[];
    currentUserName: string;
    className?: string;
}) {
    const mentionPattern = useMemo(() => {
        const names = [...memberNames]
            .sort((a, b) => b.length - a.length)
            .map(escapeRegExp);

        return names.length > 0
            ? new RegExp(`(?<![\\w@])@(${names.join('|')})(?!\\w)`, 'giu')
            : null;
    }, [memberNames]);

    const nodes = useMemo(() => {
        const output: ReactNode[] = [];
        let lastIndex = 0;

        for (const match of body.matchAll(URL_PATTERN)) {
            const url = match[0].replace(/[.,!?;:)]+$/, '');
            const start = match.index ?? 0;

            output.push(
                ...highlightMentions(
                    body.slice(lastIndex, start),
                    mentionPattern,
                    currentUserName,
                    start,
                ),
            );
            output.push(
                <a
                    key={`url-${start}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="break-all text-primary underline underline-offset-2 hover:no-underline"
                >
                    {url}
                </a>,
            );
            lastIndex = start + url.length;
        }

        output.push(
            ...highlightMentions(
                body.slice(lastIndex),
                mentionPattern,
                currentUserName,
                lastIndex,
            ),
        );

        return output;
    }, [body, mentionPattern, currentUserName]);

    return (
        <p
            className={cn(
                'text-sm leading-relaxed break-words whitespace-pre-wrap',
                className,
            )}
        >
            {nodes}
        </p>
    );
}

function highlightMentions(
    text: string,
    pattern: RegExp | null,
    currentUserName: string,
    offset: number,
): ReactNode[] {
    if (pattern === null || !text.includes('@')) {
        return [<Fragment key={`text-${offset}`}>{text}</Fragment>];
    }

    const output: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
        const start = match.index ?? 0;
        const isSelf = match[1].toLowerCase() === currentUserName.toLowerCase();

        output.push(
            <Fragment key={`text-${offset + lastIndex}`}>
                {text.slice(lastIndex, start)}
            </Fragment>,
        );
        output.push(
            <span
                key={`mention-${offset + start}`}
                className={cn(
                    'rounded px-0.5 font-medium',
                    isSelf
                        ? 'bg-amber-200/70 text-amber-950 dark:bg-amber-400/25 dark:text-amber-100'
                        : 'bg-primary/10 text-primary',
                )}
            >
                {match[0]}
            </span>,
        );
        lastIndex = start + match[0].length;
    }

    output.push(
        <Fragment key={`text-${offset + lastIndex}`}>
            {text.slice(lastIndex)}
        </Fragment>,
    );

    return output;
}
