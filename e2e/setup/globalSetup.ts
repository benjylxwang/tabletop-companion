import { chromium, type FullConfig } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { adminClient, createConfirmedUser } from './testUser';
import { STORAGE_STATE, TEST_USER_FILE } from './paths';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) throw new Error('baseURL is required in playwright config');

  const admin = adminClient();
  const user = await createConfirmedUser(admin);

  // Persist user info so specs + globalTeardown can read it.
  mkdirSync(dirname(TEST_USER_FILE), { recursive: true });
  writeFileSync(TEST_USER_FILE, JSON.stringify(user), 'utf-8');

  // Drive the real login flow so Supabase writes its session into localStorage,
  // which Playwright captures as storage state for authed test runs.
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/campaigns');

  await context.storageState({ path: STORAGE_STATE });
  await browser.close();
}
