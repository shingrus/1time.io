import {Suspense} from 'react';
import ShowNewLink from '../../components/ShowNewLink';

export const metadata = {
    robots: 'noindex, nofollow',
    title: 'Your Secret Link — onetimelink.me',
};

export default function NewLinkPage() {
    return (
        <Suspense fallback={null}>
            <ShowNewLink />
        </Suspense>
    );
}
