import { test, expect } from '@playwright/test';

test.describe('UI Components showcase (/ui-preview)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui-preview');
  });

  test('page loads with heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'UI Components' }),
    ).toBeVisible();
  });

  test('button variants are all present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Secondary' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Danger' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ghost' })).toBeVisible();
  });

  test('loading button contains spinner with role="status"', async ({ page }) => {
    const loadingButton = page.getByRole('button', { name: /Loading/i });
    await expect(loadingButton).toBeVisible();
    await expect(
      loadingButton.getByRole('status', { name: 'Loading' }),
    ).toBeVisible();
    await expect(loadingButton).toBeDisabled();
  });

  test('disabled button has disabled attribute', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  });

  test('error-state TextInput has aria-invalid', async ({ page }) => {
    const errorInput = page.locator('input[aria-invalid="true"]');
    await expect(errorInput).toBeVisible();
  });

  test('Select has role="combobox"', async ({ page }) => {
    await expect(page.getByRole('combobox')).toBeVisible();
  });

  test('Select opens dropdown when clicked', async ({ page }) => {
    await page.getByRole('combobox').click();
    await expect(page.getByRole('listbox')).toBeVisible();
    // selecting an option closes the dropdown
    await page.getByRole('option', { name: "D&D 5e" }).click();
    await expect(page.getByRole('listbox')).not.toBeVisible();
  });

  test('spinners have role="status" and aria-label="Loading"', async ({ page }) => {
    const spinners = page.getByRole('status', { name: 'Loading' });
    await expect(spinners.first()).toBeVisible();
  });

  test('empty state titles are visible', async ({ page }) => {
    await expect(page.getByText('No sessions yet')).toBeVisible();
    await expect(page.getByText('No campaigns found')).toBeVisible();
  });

  test('error display titles are visible', async ({ page }) => {
    await expect(page.getByText('Failed to load')).toBeVisible();
    await expect(page.getByText('Something went wrong')).toBeVisible();
  });

  test('modal opens and closes with Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Modal' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('modal closes on backdrop click', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Modal' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // click the backdrop (outside the panel, inside the overlay)
    await page.mouse.click(10, 10);
    await expect(dialog).not.toBeVisible();
  });

  test('confirm modal opens and closes with Cancel', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete Something' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Delete' }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
