export interface Profile {
  username: string;
  name: string;
  bio: string;
  profile_image: string | null;
  followers: number;
  following: number;
  posts?: Post[];
}

export interface AuthUser {
  username: string;
  email: string;
  name: string;
  bio: string;
  profile_image: string | null;
}

export interface Post {
  id: number;
  type: "roadmap" | "story";
  title: string;
  author: string;
  author_profile: Profile | null;
  date: string;
  description: string;
  content: string;
  graph: { nodes: RoadmapNode[]; edges: RoadmapEdge[] } | null;
  storyline: string;
  preview_url: string | null;
  tags: string[];
  roadmap_id: number | null;
  roadmap: { id: number; title: string } | null;
  like_count: number;
  comment_count: number;
  liked_by_user: boolean;
}

export interface RoadmapNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: { title: string; description: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface RoadmapEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface PostDraft {
  type: "roadmap" | "story";
  title: string;
  description: string;
  content: string;
  graph?: { nodes: RoadmapNode[]; edges: RoadmapEdge[] };
  storyline?: string;
  preview?: string;
  tags: string[];
}

export interface Comment {
  id: number;
  author: string;
  time: string;
  text: string;
  is_deleted: boolean;
  can_delete: boolean;
  replies: Comment[];
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
