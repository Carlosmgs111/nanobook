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
    if (this.ref.source === "url") return this.ref.url;
    if (this.ref.source === "local") return this.ref.path;
    if (this.ref.source === "github") {
      return `https://github.com/${this.ref.owner}/${this.ref.repo}/blob/${
        this.ref.branch ?? "main"
      }/${this.ref.path}`;
    }
    return "";
  }
  getRef(): Ref {
    return this.ref;
  }
}
