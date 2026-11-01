import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";

const emptyFields = {
  identifier: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function AccountPopover({ anchorRef, onClose, onViewProfile }) {
  const { user, loading: authLoading, statusError, login, register, logout } = useAuth();
  const [mode, setMode] = useState("login");
  const [fields, setFields] = useState(emptyFields);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [failedPhotoUrl, setFailedPhotoUrl] = useState("");
  const panelRef = useRef(null);
  const pendingRef = useRef(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });

  useEffect(() => {
    function updatePosition() {
      if (!anchorRef.current) return;
      const bounds = anchorRef.current.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(bounds.left - width - 12, window.innerWidth - width - 12)),
        top: Math.max(12, Math.min(bounds.top - 70, window.innerHeight - 500)),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (
        !panelRef.current?.contains(event.target)
        && !anchorRef.current?.contains(event.target)
      ) {
        onClose();
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        anchorRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose]);

  function updateField(event) {
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setFields(emptyFields);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pendingRef.current) return;
    setError("");
    if (mode === "register" && fields.password !== fields.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      if (mode === "login") {
        await login(fields.identifier.trim(), fields.password);
      } else {
        await register(fields.username.trim(), fields.email.trim(), fields.password);
      }
      setFields(emptyFields);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function handleLogout() {
    if (pendingRef.current) return;
    setError("");
    pendingRef.current = true;
    setPending(true);
    try {
      await logout();
      switchMode("login");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <section
      className="account-popover"
      id="account-popover"
      ref={panelRef}
      style={{ left: position.left, top: position.top }}
      aria-label="Account"
      aria-busy={pending || authLoading}
    >
      {authLoading ? (
        <p role="status">Checking your session…</p>
      ) : user ? (
        <>
          <div className="account-card-header">
            {user.profile_image && failedPhotoUrl !== user.profile_image ? (
              <img
                className="account-avatar"
                src={user.profile_image}
                alt=""
                onError={() => setFailedPhotoUrl(user.profile_image)}
              />
            ) : (
              <div className="account-avatar" aria-hidden="true">
                {(user.name || user.username).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="account-identity">
              <strong>{user.name || user.username}</strong>
              <span>@{user.username}</span>
            </div>
          </div>
          {user.bio && <p className="account-bio">{user.bio}</p>}
          {error && <p className="account-error" role="alert">{error}</p>}
          <button className="account-action primary" onClick={onViewProfile} disabled={pending}>
            View Full Profile
          </button>
          <button className="account-action" onClick={handleLogout} disabled={pending}>
            {pending ? "Switching…" : "Switch Account"}
          </button>
          <button className="account-action subtle" onClick={handleLogout} disabled={pending}>
            Log Out
          </button>
        </>
      ) : (
        <>
          <div className="account-mode-tabs" role="group" aria-label="Account access">
            <button
              type="button"
              disabled={pending}
              aria-pressed={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              disabled={pending}
              aria-pressed={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>
          {statusError && <p className="account-error" role="alert">{statusError}</p>}
          {error && <p className="account-error" role="alert">{error}</p>}
          <form className="account-form" onSubmit={handleSubmit}>
            {mode === "login" ? (
              <>
                <label>
                  Username or email
                  <input
                    autoFocus
                    autoComplete="username"
                    name="identifier"
                    value={fields.identifier}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete="current-password"
                    name="password"
                    type="password"
                    value={fields.password}
                    onChange={updateField}
                    required
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Username
                  <input
                    autoFocus
                    autoComplete="username"
                    name="username"
                    value={fields.username}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    autoComplete="email"
                    name="email"
                    type="email"
                    value={fields.email}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete="new-password"
                    name="password"
                    type="password"
                    value={fields.password}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  Confirm password
                  <input
                    autoComplete="new-password"
                    name="confirmPassword"
                    type="password"
                    value={fields.confirmPassword}
                    onChange={updateField}
                    required
                  />
                </label>
              </>
            )}
            <button className="account-submit" type="submit" disabled={pending}>
              {pending ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
