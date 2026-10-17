export interface BookNavigationContext {
  name: string;
  href: string;
}

export interface NavigationContext {
  section: "project" | "read" | "edit" | "new" | "preview";
  book?: BookNavigationContext;
}
