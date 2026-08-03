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

export function getParentPath(entryId: string): string | null {
  if (entryId === "index") return null;
  const lastSlash = entryId.lastIndexOf("/");
  return lastSlash === -1 ? "" : entryId.slice(0, lastSlash);
}

import { readFileSync } from "node:fs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { toString } from "mdast-util-to-string";
import { slug } from "github-slugger";
import type { Node } from "unist";

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export function getHeadings(entryId: string): Heading[] {
  const filePath = `./src/content/${entryId}.md`;
  try {
    const source = readFileSync(filePath, "utf-8").replace(
      /^---[\s\S]*?---\n?/,
      "",
    );
    const tree = unified().use(remarkParse).parse(source);
    const headings: Heading[] = [];

    const visit = (node: Node) => {
      const anyNode = node as any;
      if (anyNode.type === "heading" && anyNode.depth >= 2 && anyNode.depth <= 3) {
        const text = toString(anyNode);
        const headingSlug = slug(text);
        if (headingSlug) {
          headings.push({ depth: anyNode.depth, slug: headingSlug, text });
        }
      }
      if (anyNode.children && Array.isArray(anyNode.children)) {
        anyNode.children.forEach(visit);
      }
    };

    visit(tree);
    return headings;
  } catch {
    return [];
  }
}

export function getParentEntry(entryId: string, entries: any[]): any | null {
  const parentPath = getParentPath(entryId);
  if (parentPath === null) return null;
  if (parentPath === "") {
    return entries.find((e) => e.id === "index") ?? null;
  }
  return entries.find((e) => getStaticSlug(e.id) === parentPath) ?? null;
}

export function getImmediateChildren(
  entries: any[],
  folderPath: string,
  excludeId?: string,
): any[] {
  const prefix = folderPath ? `${folderPath}/` : "";
  const seen = new Set<string>();
  const children: any[] = [];

  const isValidFolder = (id: string) => {
    return entries.some((e) => e.id === id && e.data.index && !e.data.draft);
  };

  for (const entry of entries) {
    if (entry.data.draft) continue;
    if (excludeId && entry.id === excludeId) continue;
    if (!entry.id.startsWith(prefix)) continue;
    if (folderPath === "" && entry.id === "index") continue;

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

export function getSidebarEntries(
  entries: any[],
  entryId: string,
): any[] {
  const parentPath = getParentPath(entryId);
  if (parentPath === null) return [];

  return getImmediateChildren(entries, parentPath)
    .map((child) => ({ ...child, current: child.id === entryId }))
    .sort((a, b) => a.data.title.localeCompare(b.data.title));
}
