import { Paperclip, SendHorizontal, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
    ChangeEvent,
    ClipboardEvent,
    DragEvent,
    FormEvent,
    KeyboardEvent,
} from 'react';
import { UserAvatar } from '@/components/chat/user-avatar';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/chat';
import { cn } from '@/lib/utils';
import type { ConversationMemberSummary } from '@/types';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT =
    'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown,text/csv,application/zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.mp3';
const TYPING_THROTTLE_MS = 2500;

type MentionState = {
    query: string;
    start: number;
};

function findMention(text: string, caret: number): MentionState | null {
    const before = text.slice(0, caret);
    const match = before.match(/(?:^|\s)@([^\s@]*(?: [^\s@]*)?)$/u);

    if (!match) {
        return null;
    }

    return { query: match[1], start: caret - match[1].length - 1 };
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!file.type.startsWith('image/')) {
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <li className="relative flex max-w-56 items-center gap-2 rounded-md border bg-background p-1.5 pr-8 text-xs">
            {url ? (
                <img
                    src={url}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 rounded object-cover"
                />
            ) : (
                <Paperclip
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                />
            )}
            <span className="grid min-w-0">
                <span className="truncate font-medium">{file.name}</span>
                <span className="text-muted-foreground tabular-nums">
                    {formatFileSize(file.size)}
                </span>
            </span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${file.name}`}
                className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
                <X aria-hidden className="size-3.5" />
            </button>
        </li>
    );
}

/**
 * The message box: Enter to send, Shift+Enter for a new line, @ to mention, and files by picker, paste or drop.
 */
export function Composer({
    label,
    placeholder,
    members,
    currentUserId,
    onSend,
    onTyping,
    autoFocus = false,
}: {
    label: string;
    placeholder: string;
    members: ConversationMemberSummary[];
    currentUserId: number;
    onSend: (body: string, files: File[]) => void;
    onTyping?: () => void;
    autoFocus?: boolean;
}) {
    const inputId = useId();
    const listId = useId();
    const errorId = useId();
    const textarea = useRef<HTMLTextAreaElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const lastTypingAt = useRef(0);
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [mention, setMention] = useState<MentionState | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [dragging, setDragging] = useState(false);

    const suggestions = useMemo(() => {
        if (mention === null) {
            return [];
        }

        const query = mention.query.toLowerCase();

        return members
            .filter(
                (member) =>
                    member.id !== currentUserId &&
                    member.name.toLowerCase().includes(query),
            )
            .sort(
                (a, b) =>
                    Number(!a.name.toLowerCase().startsWith(query)) -
                    Number(!b.name.toLowerCase().startsWith(query)),
            )
            .slice(0, 6);
    }, [mention, members, currentUserId]);

    const showSuggestions = suggestions.length > 0;

    const addFiles = (incoming: FileList | File[]) => {
        const list = Array.from(incoming);
        const tooBig = list.find((file) => file.size > MAX_FILE_BYTES);

        if (tooBig) {
            setError(`${tooBig.name} is larger than 10 MB.`);

            return;
        }

        if (files.length + list.length > MAX_FILES) {
            setError(`You can attach up to ${MAX_FILES} files per message.`);

            return;
        }

        setError(null);
        setFiles((current) => [...current, ...list]);
    };

    const submit = (event?: FormEvent) => {
        event?.preventDefault();

        const trimmed = body.trim();

        if (trimmed === '' && files.length === 0) {
            setError('Write a message or attach a file.');
            textarea.current?.focus();

            return;
        }

        onSend(trimmed, files);
        setBody('');
        setFiles([]);
        setError(null);
        setMention(null);
        textarea.current?.focus();
    };

    const insertMention = (member: ConversationMemberSummary) => {
        if (mention === null) {
            return;
        }

        const caret = textarea.current?.selectionStart ?? body.length;
        const next = `${body.slice(0, mention.start)}@${member.name} ${body.slice(caret)}`;
        const position = mention.start + member.name.length + 2;

        setBody(next);
        setMention(null);

        requestAnimationFrame(() => {
            textarea.current?.focus();
            textarea.current?.setSelectionRange(position, position);
        });
    };

    const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const value = event.target.value;
        setBody(value);
        setError(null);
        setMention(findMention(value, event.target.selectionStart));
        setActiveIndex(0);

        if (
            onTyping &&
            value.trim() !== '' &&
            Date.now() - lastTypingAt.current > TYPING_THROTTLE_MS
        ) {
            lastTypingAt.current = Date.now();
            onTyping();
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (showSuggestions) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const step = event.key === 'ArrowDown' ? 1 : -1;
                setActiveIndex(
                    (index) =>
                        (index + step + suggestions.length) %
                        suggestions.length,
                );

                return;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                insertMention(suggestions[activeIndex]);

                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                setMention(null);

                return;
            }
        }

        if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
        ) {
            event.preventDefault();
            submit();
        }
    };

    const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
        if (event.clipboardData.files.length > 0) {
            event.preventDefault();
            addFiles(event.clipboardData.files);
        }
    };

    const onDrop = (event: DragEvent<HTMLFormElement>) => {
        event.preventDefault();
        setDragging(false);

        if (event.dataTransfer.files.length > 0) {
            addFiles(event.dataTransfer.files);
        }
    };

    return (
        <form
            onSubmit={submit}
            onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className="relative"
            noValidate
        >
            {showSuggestions && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label="Mention someone"
                    className="absolute right-0 bottom-full left-0 z-20 mb-2 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
                >
                    {suggestions.map((member, index) => (
                        <li
                            key={member.id}
                            id={`${listId}-${member.id}`}
                            role="option"
                            aria-selected={index === activeIndex}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                insertMention(member);
                            }}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={cn(
                                'flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm',
                                index === activeIndex &&
                                    'bg-accent text-accent-foreground',
                            )}
                        >
                            <UserAvatar
                                user={member}
                                showPresence
                                className="size-6"
                            />
                            {member.name}
                        </li>
                    ))}
                </ul>
            )}

            <div
                className={cn(
                    'rounded-xl border bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
                    dragging && 'border-primary ring-[3px] ring-primary/30',
                    error && 'border-destructive',
                )}
            >
                {files.length > 0 && (
                    <ul
                        className="flex flex-wrap gap-2 border-b p-2"
                        aria-label="Files to send"
                    >
                        {files.map((file, index) => (
                            <FilePreview
                                key={`${file.name}-${index}`}
                                file={file}
                                onRemove={() =>
                                    setFiles((current) =>
                                        current.filter(
                                            (_, position) => position !== index,
                                        ),
                                    )
                                }
                            />
                        ))}
                    </ul>
                )}

                <label htmlFor={inputId} className="sr-only">
                    {label}
                </label>
                <textarea
                    ref={textarea}
                    id={inputId}
                    value={body}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    onPaste={onPaste}
                    onBlur={() => setMention(null)}
                    placeholder={placeholder}
                    rows={1}
                    maxLength={5000}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showSuggestions}
                    aria-controls={showSuggestions ? listId : undefined}
                    aria-activedescendant={
                        showSuggestions
                            ? `${listId}-${suggestions[activeIndex]?.id}`
                            : undefined
                    }
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className="block field-sizing-content max-h-48 min-h-11 w-full resize-none bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted-foreground md:text-sm"
                />

                <div className="flex items-center gap-1 px-1.5 pb-1.5">
                    <input
                        ref={fileInput}
                        type="file"
                        multiple
                        accept={ACCEPT}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden
                        onChange={(event) => {
                            if (event.target.files) {
                                addFiles(event.target.files);
                            }

                            event.target.value = '';
                        }}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label="Attach files"
                        title="Attach files"
                        onClick={() => fileInput.current?.click()}
                    >
                        <Paperclip />
                    </Button>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                        <kbd className="font-sans">Enter</kbd> to send ·{' '}
                        <kbd className="font-sans">Shift + Enter</kbd> for a new
                        line
                    </span>
                    <Button
                        type="submit"
                        size="icon"
                        className="ml-auto size-9"
                        aria-label="Send message"
                        title="Send message"
                    >
                        <SendHorizontal />
                    </Button>
                </div>
            </div>

            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="mt-1.5 text-sm text-destructive"
                >
                    {error}
                </p>
            )}
        </form>
    );
}
