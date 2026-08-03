export function getStaticSlug(entryId: string): string | undefined {
  return entryId === "index" ? undefined : entryId;
}

export function getFolderPath(entryId: string): string {
  return entryId === "index" ? "" : entryId;
}

export function getImmediateChildren(
  entries: any[],
  currentId: string,
  folderPath: string,
): any[] {
  const prefix = folderPath ? `${folderPath}/` : "";
  const seen = new Set<string>();
  const children: any[] = [];

  const isValidFolder = (id: string) => {
    return entries.some((e) => e.id === id && e.data.index && !e.data.draft);
  };

  for (const entry of entries) {
    if (entry.data.draft) continue;
    if (entry.id === currentId) continue;
    if (!entry.id.startsWith(prefix)) continue;

    const relative = entry.id.slice(prefix.length);
    if (!relative) continue;
    if (entry.id === folderPath) continue;

    const slashIndex = relative.indexOf("/");

    if (slashIndex === -1) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        children.push(entry);
      }
    } else {
      const subfolder = relative.slice(0, slashIndex);
      const subfolderId = folderPath
        ? `${folderPath}/${subfolder}`
        : subfolder;

      if (isValidFolder(subfolderId) && !seen.has(subfolderId)) {
        const folderEntry = entries.find((e) => e.id === subfolderId);
        if (folderEntry) {
          seen.add(subfolderId);
          children.push(folderEntry);
        }
      }
    }
  }

  return children;
}
