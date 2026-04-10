const keyFor = (variant: "public" | "internal") => `passage_thread_${variant}`;

export function getOrCreateThreadId(variant: "public" | "internal"): string {
  const key = keyFor(variant);
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function resetThreadId(variant: "public" | "internal"): string {
  const id = crypto.randomUUID();
  localStorage.setItem(keyFor(variant), id);
  return id;
}
