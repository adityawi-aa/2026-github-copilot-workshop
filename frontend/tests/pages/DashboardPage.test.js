import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DashboardPage from '../../src/pages/DashboardPage.vue';
import * as apiModule from '../../src/api';

describe('DashboardPage Component', () => {
  const globalStubs = {
    RouterLink: {
      template: '<a><slot /></a>',
    },
  };

  it('renders stats and recent purchase requisitions from API', async () => {
    const mockDashboardData = {
      totalPr: 5,
      draftPr: 1,
      submittedPr: 2,
      approvedPr: 2,
      recentPr: [
        {
          id: 'pr-1',
          prNumber: 'PR-2026-0001',
          requesterName: 'Aditya',
          status: 'APPROVED',
          createdAt: '2026-09-01T08:00:00.000Z',
        },
      ],
    };

    vi.spyOn(apiModule.api, 'getDashboard').mockResolvedValue(mockDashboardData);

    const wrapper = mount(DashboardPage, {
      global: {
        stubs: globalStubs,
      },
    });

    // Wait for onMounted API promise resolution
    await vi.dynamicImportSettled();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.find('h2').text()).toBe('Procurement Dashboard');
    expect(wrapper.text()).toContain('Overview of PR, PO and GR activities');

    const statValues = wrapper.findAll('.stat-card-value');
    expect(statValues[0].text()).toBe('5');
    expect(statValues[1].text()).toBe('1');
    expect(statValues[2].text()).toBe('2');
    expect(statValues[3].text()).toBe('2');

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('PR-2026-0001');
    expect(rows[0].text()).toContain('Aditya');
    expect(rows[0].text()).toContain('APPROVED');
  });
});
