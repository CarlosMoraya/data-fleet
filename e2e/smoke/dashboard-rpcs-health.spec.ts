import { expect, test } from '@playwright/test';

const DASHBOARD_RPCS = [
  'dashboard_last_checklist_per_vehicle',
  'dashboard_vehicle_km_in_period',
] as const;

type DashboardRpc = (typeof DASHBOARD_RPCS)[number];

test.describe('Dashboard RPCs health', () => {
  test('no dashboard RPC returns 404 (PGRST202)', async ({ page }) => {
    const rpcStatuses: Partial<Record<DashboardRpc, number>> = {};
    const rpc404Bodies: string[] = [];

    page.on('response', async (response) => {
      const url = new URL(response.url());
      const match = url.pathname.match(/^\/rest\/v1\/rpc\/(.+)$/);
      if (!match) return;

      const rpcName = match[1];
      if (!(DASHBOARD_RPCS as readonly string[]).includes(rpcName)) return;

      rpcStatuses[rpcName as DashboardRpc] = response.status();

      if (response.status() === 404) {
        const body = await response.text().catch(() => '');
        rpc404Bodies.push(`${rpcName}: ${body}`);
      }
    });

    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(6000);

    const uncalled = DASHBOARD_RPCS.filter((name) => !(name in rpcStatuses));
    const failures: string[] = [];

    for (const name of uncalled) {
      failures.push(`${name} was not called during Dashboard load`);
    }

    for (const [name, status] of Object.entries(rpcStatuses)) {
      if (status === 404) {
        failures.push(
          `${name} returned 404 (PGRST202 — function not found in schema cache)`,
        );
      }
    }

    expect(
      [...failures, ...rpc404Bodies],
      `Dashboard RPC health check failures:\n${[...failures, ...rpc404Bodies].join('\n')}`,
    ).toHaveLength(0);
  });
});