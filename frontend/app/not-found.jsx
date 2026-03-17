'use client';

import {useRouter} from "next/navigation";

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="error-page">
            <h2>404</h2>
            <p>This page doesn&apos;t exist.</p>
            <button
                className="btn btn-primary"
                type="button"
                onClick={() => router.push('/')}
            >
                Go home
            </button>
        </div>
    );
}
