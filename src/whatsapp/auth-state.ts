import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

export async function loadAuthState() {
  return useMultiFileAuthState(env.SESSIONS_PATH);
}
