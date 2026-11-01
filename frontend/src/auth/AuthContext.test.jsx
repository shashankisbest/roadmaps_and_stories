import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { AuthProvider } from "./AuthContext.jsx";
import { useAuth } from "./useAuth";

vi.mock("../api/client", () => ({
  api: {
    currentUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  },
}));

function AuthState() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <p>{loading ? "Loading" : user?.username || "Anonymous"}</p>
      <button onClick={() => login("member", "password")}>Log in</button>
      <button onClick={logout}>Log out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the current session and updates authentication state", async () => {
    expect(AuthProvider).toBeTypeOf("function");
    api.currentUser.mockResolvedValueOnce(null);
    api.login.mockResolvedValueOnce({ username: "member" });
    api.logout.mockResolvedValueOnce(undefined);
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    expect(screen.getByText("Loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Anonymous")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(screen.getByText("member")).toBeTruthy());
    expect(api.login).toHaveBeenCalledWith("member", "password");

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(screen.getByText("Anonymous")).toBeTruthy());
  });
});
