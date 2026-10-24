import { echo, echoIsConfigured } from '@laravel/echo-react';

type Endpoint = {
    url: string;
    method: string;
};

export class HttpError extends Error {
    constructor(
        message: string,
        public status: number,
        public errors: Record<string, string[]> = {},
    ) {
        super(message);
    }

    /**
     * The first validation message, falling back to the general message.
     */
    firstError(): string {
        return Object.values(this.errors)[0]?.[0] ?? this.message;
    }
}

function xsrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : null;
}

function socketId(): string | null {
    if (!echoIsConfigured()) {
        return null;
    }

    try {
        return echo().socketId() ?? null;
    } catch {
        return null;
    }
}

/**
 * Send a JSON (or multipart) request to a Wayfinder endpoint outside of an Inertia visit.
 */
export async function request<T = unknown>(
    endpoint: Endpoint,
    body?: Record<string, unknown> | FormData,
): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    const token = xsrfToken();
    const socket = socketId();

    if (token) {
        headers['X-XSRF-TOKEN'] = token;
    }

    if (socket) {
        headers['X-Socket-ID'] = socket;
    }

    if (body !== undefined && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(endpoint.url, {
        method: endpoint.method.toUpperCase(),
        headers,
        credentials: 'same-origin',
        body:
            body === undefined
                ? undefined
                : body instanceof FormData
                  ? body
                  : JSON.stringify(body),
    });

    if (response.status === 204) {
        return undefined as T;
    }

    const payload: unknown = await response.json().catch(() => ({}));

    if (!response.ok) {
        const data = payload as {
            message?: string;
            errors?: Record<string, string[]>;
        };

        throw new HttpError(
            data.message ?? 'Something went wrong. Please try again.',
            response.status,
            data.errors ?? {},
        );
    }

    return payload as T;
}

export function errorMessage(error: unknown): string {
    if (error instanceof HttpError) {
        return error.firstError();
    }

    return 'Something went wrong. Please try again.';
}
