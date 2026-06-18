import { dashboardKeys } from '@/features/dashboard/hooks/use-dashboard';

describe('dashboardKeys', () => {
  it('builds stable query keys', () => {
    expect(dashboardKeys.summary).toEqual(['dashboard', 'summary']);
    expect(dashboardKeys.activity(7)).toEqual(['dashboard', 'activity', 7]);
    expect(dashboardKeys.activity(30)).toEqual(['dashboard', 'activity', 30]);
  });
});
