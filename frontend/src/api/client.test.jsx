import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("API client", () => {
  it("unwraps paginated roadmap results and includes session credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ count: 1, results: [{ id: 17, title: "Roadmap" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.roadmaps()).resolves.toEqual([{ id: 17, title: "Roadmap" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ href: "http://localhost:8000/api/roadmaps/" }),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("fetches a CSRF token before JSON mutations", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: "test-csrf-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 23, title: "New story" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.createPost({
      type: "story",
      title: "New story",
      content: "Story body",
    })).resolves.toEqual({ id: 23, title: "New story" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ href: "http://localhost:8000/api/auth/csrf/" }),
      { credentials: "include" },
    );
    const request = fetchMock.mock.calls[1][1];
    expect(request).toEqual(expect.objectContaining({
      credentials: "include",
      method: "POST",
    }));
    expect(request.headers.get("Content-Type")).toBe("application/json");
    expect(request.headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(request.body).toContain('"title":"New story"');
  });

  it("reports API validation errors with their HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ title: ["This field is required."] }),
    }));

    await expect(api.roadmaps()).rejects.toMatchObject({
      name: "ApiError",
      message: "title: This field is required.",
      status: 400,
    });
    expect(ApiError).toBeDefined();
  });

  it("requests comment integrity verification without sending a hash", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ valid: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.verifyComment(42)).resolves.toEqual({ valid: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ href: "http://localhost:8000/api/comments/42/verify/" }),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });
});
