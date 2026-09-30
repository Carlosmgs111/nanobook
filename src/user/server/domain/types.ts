export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  id?: string;
  email: string;
  displayName: string;
  createdAt?: Date;
  updatedAt?: Date;
  now?: Date;
}

export interface UpdateUserProfileData {
  email?: string;
  displayName?: string;
  now?: Date;
}
