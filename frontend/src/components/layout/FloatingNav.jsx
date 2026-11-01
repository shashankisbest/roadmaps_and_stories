import { useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import AccountPopover from "../auth/AccountPopover";

export default function FloatingNav({
  menuOpen,
  onToggleMenu,
  onOpenProfile,
  onOpenCreate,
  onOpenStories,
  onOpenExplore,
  onViewFullProfile,
}) {
  const { user } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const profileButtonRef = useRef(null);

  return (
    <div className={`floating-nav ${menuOpen ? "open" : ""}`}>
      <div className="nav-bubbles">
        <button
          className="nav-bubble search-bubble"
          title="Search"
          onClick={() => onOpenStories()}
        >
          ⌕
        </button>
        <button
          className="nav-bubble create-bubble"
          title="Create"
          aria-label="Create a post"
          onClick={onOpenCreate}
        >
          +
        </button>
        <button
          className="nav-bubble explore-bubble"
          title="Explore"
          onClick={() => onOpenExplore()}
        >
          ◇
        </button>
        <button
          className="nav-bubble saved-bubble"
          title="Saved"
          onClick={() => onOpenProfile()}
        >
          ♡
        </button>
        <button
          className="nav-bubble profile-bubble"
          title="Account"
          aria-label="Open account"
          aria-expanded={accountOpen}
          aria-controls="account-popover"
          ref={profileButtonRef}
          onClick={() => setAccountOpen((open) => !open)}
        >
          {user ? (user.name || user.username).charAt(0).toUpperCase() : "S"}
        </button>
      </div>
      {accountOpen && (
        <AccountPopover
          anchorRef={profileButtonRef}
          onClose={() => setAccountOpen(false)}
          onViewProfile={() => {
            onViewFullProfile();
            setAccountOpen(false);
          }}
        />
      )}

      <button
        className="main-nav-bubble"
        onClick={onToggleMenu}
        aria-label="Toggle navigation"
      >
        {menuOpen ? "×" : "☰"}
      </button>
    </div>
  );
}
