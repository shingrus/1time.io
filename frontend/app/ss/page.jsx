import StatsSnapshot from '../../components/StatsSnapshot';
import {siteHost} from '../../utils/siteConfig';

export const metadata = {
    robots: 'noindex, nofollow',
    title: `In-Memory Stats — ${siteHost}`,
    description: `Current in-memory stats snapshot for ${siteHost}.`,
};

export default function StatsSnapshotPage() {
    return <StatsSnapshot />;
}
