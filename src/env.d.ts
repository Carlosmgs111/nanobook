declare namespace App {
  interface Locals {
    currentUserId?: string;
    currentUser?: import("./auth/shared/AuthSession").AuthenticatedUser;
  }
}
