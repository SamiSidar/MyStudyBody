/**
 * Authenticated API helper.
 * Automatically injects X-User-ID header from AsyncStorage for every request.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const STORAGE_KEY = 'msb_user';

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.id) {
        return {
          'Content-Type': 'application/json',
          'X-User-ID': user.id,
        };
      }
    }
  } catch (_) {}
  return { 'Content-Type': 'application/json' };
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = await authHeaders();
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}
