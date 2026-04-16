import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const STORAGE_STATE = resolve(__dirname, 'storageState.json');
export const TEST_USER_FILE = resolve(__dirname, 'testUser.json');
