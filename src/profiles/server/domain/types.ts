export interface CreateProfileData {
  userId: string;
  username: string;
  displayName: string;
  now?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PublicProfile {
  username: string;
  displayName: string;
}

export interface PersistedProfile extends PublicProfile {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
