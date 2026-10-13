declare namespace App {
  interface Locals {
    currentUserId?: string;
    currentUser?: import("./auth/browser/model/AuthSession").AuthenticatedUser;
  }
}
