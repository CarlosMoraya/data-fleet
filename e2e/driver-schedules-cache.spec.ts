import { test, expect } from '@playwright/test';

/**
 * Regression test: Driver sees schedules after SPA navigation from /checklists
 * to /agendamentos — no 400 error from cached queryKey collision.
 *
 * Bug: Checklists.tsx and WorkshopSchedules.tsx shared the same queryKey
 * ['driverVehicle', userId, clientId] but returned different data types
 * (object vs string). After SPA navigation, the cached object was used as
 * vehicle_id, producing [object Object] and causing a 400 from PostgREST.
 *
 * Fix: WorkshopSchedules now uses a dedicated queryKey
 * ['driverScheduleVehicleId', userId, clientId] and a stricter enabled guard.
 */

test.describe('Driver schedules — SPA navigation cache regression', () => {
  test.use({ storageState: 'e2e/.auth/jorge.json' });

  test('driver sees schedules after SPA navigation from Checklists (no 400)', async ({ page }) => {
    // Collect workshop_schedules responses during navigation
    const scheduleRequestUrls: string[] = [];
    const scheduleResponseStatuses: { url: string; status: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('workshop_schedules')) {
        scheduleRequestUrls.push(url);
        scheduleResponseStatuses.push({ url, status: response.status() });
      }
    });

    // 1. Start on /checklists (default driver landing page)
    await page.goto('/checklists');
    await expect(page.getByText('Meu veículo')).toBeVisible({ timeout: 15000 });

    // 2. Navigate to Agendamentos via sidebar link (SPA — no page.reload())
    const agendamentosLink = page.getByRole('link', { name: 'Agendamentos' });
    await expect(agendamentosLink).toBeVisible();
    await agendamentosLink.click();

    // 3. Wait for the Agendamentos page to finish rendering
    //    Either heading "Agendamentos" or empty state text should appear.
    await expect(page.locator('h1').filter({ hasText: 'Agendamentos' })).toBeVisible({ timeout: 15000 });

    // 4. Assert: no request to workshop_schedules returned 400
    //    and no URL contains vehicle_id=eq.[object Object]
    const badRequests = scheduleResponseStatuses.filter(
      (r) => r.status === 400 || r.url.includes('vehicle_id=eq.[object Object]')
    );
    expect(badRequests).toHaveLength(0);
  });
});