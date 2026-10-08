export interface CreateProfileData {
  userId: string;
  username: string;
  displayName: string;
  now?: Date;
}

export interface PublicProfile {
  username: string;
  displayName: string;
}
