export async function getItem(key: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (typeof window !== 'undefined') window.localStorage.removeItem(key);
}
