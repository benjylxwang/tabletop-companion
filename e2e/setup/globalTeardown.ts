import { readFileSync, existsSync, unlinkSync } from 'fs';
import { adminClient, deleteUser, type TestUser } from './testUser';
import { STORAGE_STATE, TEST_USER_FILE } from './paths';

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(TEST_USER_FILE)) return;
  const user = JSON.parse(readFileSync(TEST_USER_FILE, 'utf-8')) as TestUser;

  const admin = adminClient();
  await deleteUser(admin, user.id);

  unlinkSync(TEST_USER_FILE);
  if (existsSync(STORAGE_STATE)) unlinkSync(STORAGE_STATE);
}
