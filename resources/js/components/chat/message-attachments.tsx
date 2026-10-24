import { Download, FileText } from 'lucide-react';
import { formatFileSize } from '@/lib/chat';
import type { Attachment, LinkPreview } from '@/types';

export function MessageAttachments({
    attachments,
}: {
    attachments: Attachment[];
}) {
    if (attachments.length === 0) {
        return null;
    }

    return (
        <ul className="mt-1.5 flex flex-wrap gap-2" aria-label="Attachments">
            {attachments.map((attachment) =>
                attachment.is_image ? (
                    <li key={attachment.id}>
                        <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <img
                                src={attachment.url}
                                alt={attachment.name}
                                width={attachment.width ?? 320}
                                height={attachment.height ?? 240}
                                loading="lazy"
                                className="h-auto max-h-72 w-auto max-w-[min(20rem,100%)] object-contain"
                                style={
                                    attachment.width && attachment.height
                                        ? {
                                              aspectRatio: `${attachment.width} / ${attachment.height}`,
                                          }
                                        : undefined
                                }
                            />
                        </a>
                    </li>
                ) : (
                    <li key={attachment.id}>
                        <a
                            href={
                                attachment.id > 0
                                    ? `${attachment.url}?download=1`
                                    : undefined
                            }
                            className="flex min-h-11 max-w-xs items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <FileText
                                aria-hidden
                                className="size-5 shrink-0 text-muted-foreground"
                            />
                            <span className="grid min-w-0">
                                <span className="truncate font-medium">
                                    {attachment.name}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {formatFileSize(attachment.size)}
                                </span>
                            </span>
                            {attachment.id > 0 && (
                                <Download
                                    aria-label="Download"
                                    className="ml-auto size-4 shrink-0 text-muted-foreground"
                                />
                            )}
                        </a>
                    </li>
                ),
            )}
        </ul>
    );
}

export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
    return (
        <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1.5 flex max-w-lg gap-3 overflow-hidden rounded-lg border-l-4 border-l-primary/40 bg-muted/50 p-3 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            <span className="grid min-w-0 flex-1 gap-0.5">
                {preview.site_name && (
                    <span className="truncate text-xs text-muted-foreground">
                        {preview.site_name}
                    </span>
                )}
                {preview.title && (
                    <span className="line-clamp-2 text-sm font-medium text-primary">
                        {preview.title}
                    </span>
                )}
                {preview.description && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                        {preview.description}
                    </span>
                )}
            </span>
            {preview.image && (
                <img
                    src={preview.image}
                    alt=""
                    width={80}
                    height={80}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="size-20 shrink-0 rounded-md object-cover"
                />
            )}
        </a>
    );
}
