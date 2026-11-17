export interface LocalRef {
  source: "local";
  path: string;
}

export interface GitHubRef {
  source: "github";
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

export interface UrlRef {
  source: "url";
  url: string;
}

export type Ref = LocalRef | GitHubRef | UrlRef;

export class DocumentReference {
  private ref: Ref;
  constructor(ref: Ref | string) {
    if (typeof ref === "string") {
      this.ref = { source: "local", path: ref };
      return;
    }
    this.ref = ref;
  }
  getValue(): string {
    const ref = this.ref;
    if (ref.source === "url") return ref.url;
    if (ref.source === "local") return ref.path;
    return `https://github.com/${ref.owner}/${ref.repo}/blob/${ref.branch ?? "main"}/${ref.path}`;
  }
  getRef(): Ref {
    return this.ref;
  }
}
