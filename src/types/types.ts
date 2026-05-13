export type UserRole = "user" | "admin";

export interface Profile {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content?: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  created_at: string;
  expires_at: string;
  profiles?: Profile;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  from_user_id?: string | null;
  type: string;
  content: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  creator_id: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}
