declare namespace App {
  interface Locals {
    currentUserId?: string;
    currentUser?: import("../browser/auth/model/AuthSession").AuthenticatedUser;
  }
}
