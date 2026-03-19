'use client';

import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {getStatsPageName, sendStatsPing} from '../utils/util';

export default function PageStatsTracker() {
    const pathname = usePathname();
    const statsPage = getStatsPageName(pathname);

    useEffect(() => {
        sendStatsPing(statsPage);
    }, [statsPage]);

    return null;
}
