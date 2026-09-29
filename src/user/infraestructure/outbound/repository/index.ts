import { InMemoryUserRepository } from "./InMemoryUserRepository";

export function createUserRepository() {
  return new InMemoryUserRepository();
}

export { InMemoryUserRepository } from "./InMemoryUserRepository";
