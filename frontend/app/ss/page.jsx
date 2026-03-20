import StatsSnapshot from '../../components/StatsSnapshot';
import {siteHost} from '../../utils/siteConfig';

export const metadata = {
    robots: 'noindex, nofollow',
    title: `In-Memory Stats — ${siteHost}`,
    description: `Current in-memory stats snapshot for ${siteHost}.`,
    alternates: { canonical: '/ss' },
};

export default function StatsSnapshotPage() {
    return <StatsSnapshot />;
}
