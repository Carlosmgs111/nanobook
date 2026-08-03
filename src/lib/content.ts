export function getStaticSlug(entryId: string): string | undefined {
  return entryId === "index" ? undefined : entryId;
}

export function getFolderPath(entryId: string): string {
  return entryId === "index" ? "" : entryId;
}

export function getBreadcrumbs(
  entryId: string,
  entries: any[],
  homeTitle: string = "Inicio",
): { id: string; title: string; href: string; current: boolean }[] {
  const crumbs = [{ id: "index", title: homeTitle, href: "/", current: false }];

  if (entryId === "index") {
    crumbs[0].current = true;
    return crumbs;
  }

  const segments = entryId.split("/");
  let path = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    path = path ? `${path}/${segment}` : segment;

    const entry = entries.find((e) => e.id === path);
    const title = entry?.data?.title ?? segment;
    const isCurrent = i === segments.length - 1;

    crumbs.push({
      id: path,
      title,
      href: `/${path}/`,
      current: isCurrent,
    });
  }

  return crumbs;
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
