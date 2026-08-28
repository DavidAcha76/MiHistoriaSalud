import { apiFetchRaw } from '../api/client';

export async function openAuthorizedDocument(path: string, name: string): Promise<void> {
  const response = await apiFetchRaw(path);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
