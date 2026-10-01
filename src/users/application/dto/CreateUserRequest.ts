export interface CreateUserRequest {
  id?: string;
  email: string;
  displayName: string;
  createdAt?: Date;
  now?: Date;
}
