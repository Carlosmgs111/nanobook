declare namespace App {
  interface Locals {
    currentUserId?: string;
    currentUser?: import("./auth/model/AuthSession").AuthenticatedUser;
  }
}
