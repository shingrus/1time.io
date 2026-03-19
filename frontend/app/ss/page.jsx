import StatsSnapshot from '../../components/StatsSnapshot';

export const metadata = {
    robots: 'noindex, nofollow',
    title: 'In-Memory Stats — onetimelink.me',
    description: 'Current in-memory stats snapshot for onetimelink.me.',
    alternates: { canonical: '/ss' },
};

export default function StatsSnapshotPage() {
    return <StatsSnapshot />;
}
