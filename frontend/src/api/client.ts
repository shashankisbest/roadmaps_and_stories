import type { AuthUser, Comment, Page, Post, PostDraft, Profile } from "./types";

function resolveApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;
  if (configuredUrl) return configuredUrl;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return `${window.location.protocol}//${hostname}:8000/api/`;
  }

  return `http://${import.meta.env.VITE_LAN_IP || "localhost"}:8000/api/`;
}

const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

function rememberCsrfToken(token: string): void {
  csrfToken = token;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
    const url = new URL("auth/csrf/", base);
    csrfRequest = fetch(url, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new ApiError(`Could not prepare a secure request (${response.status})`, response.status);
        }
        const body = (await response.json()) as { csrfToken: string };
        const token = body.csrfToken;
        csrfToken = token;
        return token;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
}

function formatErrorBody(body: unknown): string | null {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return null;
  if ("detail" in body && typeof body.detail === "string") return body.detail;

  const messages = Object.entries(body)
    .map(([field, value]) => {
      const details = Array.isArray(value) ? value.join(", ") : String(value);
      return field === "non_field_errors" ? details : `${field}: ${details}`;
    })
    .filter(Boolean);
  return messages.length ? messages.join("; ") : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const url = new URL(path.replace(/^\/+/, ""), base);
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    headers.set("X-CSRFToken", await getCsrfToken());
  }
  const response = await fetch(url, {
    ...options,
    method,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      message = formatErrorBody(await response.json()) || message;
    } catch {
      if (response.statusText) message = response.statusText;
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function paginated<T>(path: string): Promise<T[]> {
  const page = await request<Page<T> | T[]>(path);
  return Array.isArray(page) ? page : page.results;
}

export const api = {
  roadmaps: () => paginated<Post>("roadmaps/"),
  roadmap: (postId: number) => request<Post>(`roadmaps/${postId}/`),
  stories: () => paginated<Post>("stories/"),
  createPost: (post: PostDraft) =>
    request<Post>("posts/create/", {
      method: "POST",
      body: JSON.stringify(post),
    }),
  profile: (username: string) =>
    request<Profile>(`profiles/${encodeURIComponent(username)}/`),
  comments: (postId: number) => request<Comment[]>(`posts/${postId}/comments/`),
  createComment: (postId: number, body: string, parentCommentId?: number) =>
    request<Comment[]>(`posts/${postId}/comments/`, {
      method: "POST",
      body: JSON.stringify({
        body,
        ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
      }),
    }),
  deleteComment: (commentId: number) =>
    request<void>(`comments/${commentId}/`, { method: "DELETE" }),
  toggleLike: (postId: number, liked: boolean) =>
    request<{ liked: boolean; like_count: number }>(
      `posts/${postId}/like/`,
      { method: liked ? "POST" : "DELETE" },
    ),
  currentUser: async () => {
    const response = await request<{ user: AuthUser | null }>("auth/current-user/");
    return response.user;
  },
  register: async (username: string, email: string, password: string) => {
    const response = await request<{ user: AuthUser; csrfToken: string }>("auth/register/", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    rememberCsrfToken(response.csrfToken);
    return response.user;
  },
  login: async (identifier: string, password: string) => {
    const response = await request<{ user: AuthUser; csrfToken: string }>("auth/login/", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    rememberCsrfToken(response.csrfToken);
    return response.user;
  },
  logout: () =>
    request<void>("auth/logout/", { method: "POST" }),
};

export type { AuthUser, Comment, Post, Profile };
