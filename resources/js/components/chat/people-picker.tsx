import { Check, Search, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { UserAvatar } from '@/components/chat/user-avatar';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { request } from '@/lib/http';
import { cn } from '@/lib/utils';
import { index as peopleIndex } from '@/routes/people';
import type { UserSummary } from '@/types';

/**
 * Search the workspace for people, picking one or many.
 */
export function PeoplePicker({
    selected,
    onChange,
    multiple = true,
    excludeIds = [],
    label = 'Find people',
    autoFocus = false,
}: {
    selected: UserSummary[];
    onChange: (people: UserSummary[]) => void;
    multiple?: boolean;
    excludeIds?: number[];
    label?: string;
    autoFocus?: boolean;
}) {
    const inputId = useId();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const timer = window.setTimeout(() => {
            setLoading(true);
            request<{ data: UserSummary[] }>(peopleIndex({ query: { search } }))
                .then((response) => {
                    if (!cancelled) {
                        setResults(response.data);
                        setFailed(false);
                    }
                })
                .catch(() => !cancelled && setFailed(true))
                .finally(() => !cancelled && setLoading(false));
        }, 200);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [search]);

    const selectedIds = new Set(selected.map((person) => person.id));
    const visible = results.filter((person) => !excludeIds.includes(person.id));

    const toggle = (person: UserSummary) => {
        if (!multiple) {
            onChange([person]);

            return;
        }

        onChange(
            selectedIds.has(person.id)
                ? selected.filter((existing) => existing.id !== person.id)
                : [...selected, person],
        );
    };

    return (
        <div className="grid gap-2">
            <label htmlFor={inputId} className="text-sm font-medium">
                {label}
            </label>
            <div className="relative">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    id={inputId}
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name or email…"
                    autoComplete="off"
                    autoFocus={autoFocus}
                    className="pl-8 text-base md:text-sm"
                />
            </div>

            {multiple && selected.length > 0 && (
                <ul
                    className="flex flex-wrap gap-1.5"
                    aria-label="Selected people"
                >
                    {selected.map((person) => (
                        <li key={person.id}>
                            <button
                                type="button"
                                onClick={() => toggle(person)}
                                className="inline-flex min-h-7 items-center gap-1 rounded-md bg-secondary px-2 text-xs font-medium hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                aria-label={`Remove ${person.name}`}
                            >
                                {person.name}
                                <X aria-hidden className="size-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="max-h-56 overflow-y-auto rounded-md border">
                {loading && results.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                        <Spinner /> Loading people…
                    </div>
                ) : failed ? (
                    <p className="p-4 text-sm text-destructive">
                        Couldn’t load people. Try typing again.
                    </p>
                ) : visible.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                        No one matches “{search}”.
                    </p>
                ) : (
                    <ul role="listbox" aria-multiselectable={multiple}>
                        {visible.map((person) => {
                            const isSelected = selectedIds.has(person.id);

                            return (
                                <li
                                    key={person.id}
                                    role="option"
                                    aria-selected={isSelected}
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggle(person)}
                                        className={cn(
                                            'flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                                            isSelected && 'bg-accent/60',
                                        )}
                                    >
                                        <UserAvatar
                                            user={person}
                                            showPresence
                                            className="size-7"
                                        />
                                        <span className="flex-1 truncate">
                                            {person.name}
                                        </span>
                                        {isSelected && (
                                            <Check
                                                aria-hidden
                                                className="size-4 text-primary"
                                            />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
