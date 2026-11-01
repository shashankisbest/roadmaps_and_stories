import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { api } from "./api/client";
import MainLayout from "./components/layout/MainLayout";
import FloatingNav from "./components/layout/FloatingNav";
import FeedPanel from "./components/feed/FeedPanel";
import CommentSection from "./components/comments/CommentSection";
import RoadmapDetail from "./components/roadmaps/RoadmapDetail";
import StoryDetail from "./components/stories/StoryDetail";
import ProfileView from "./components/profiles/ProfileView";
import PostCreationOverlay from "./components/creation/PostCreationOverlay";
import RoadmapViewerOverlay from "./components/creation/RoadmapViewerOverlay";
import { useAuth } from "./auth/useAuth";

const emptyProfile = {
  username: "",
  name: "Profile",
  bio: "",
  followers: 0,
  following: 0,
  profile_image: null,
  posts: [],
};

function normalizePost(post) {
  return {
    ...post,
    roadmapId: post.roadmap_id,
    date: post.date.slice(0, 10),
  };
}

function App() {
  const { user } = useAuth();
  const [roadmaps, setRoadmaps] = useState([]);
  const [stories, setStories] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const [activeFeed, setActiveFeed] = useState("roadmaps");
  const [rightPanel, setRightPanel] = useState("comments");
  const [menuOpen, setMenuOpen] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const [viewingRoadmap, setViewingRoadmap] = useState(null);
  const [profileFilter, setProfileFilter] = useState("all");
  const [comments, setComments] = useState([]);
  const [commentsLoadedFor, setCommentsLoadedFor] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [actionError, setActionError] = useState("");
  const [viewedProfile, setViewedProfile] = useState(emptyProfile);
  const [profileUsernameOverride, setProfileUsernameOverride] = useState(null);
  const activeItemIdRef = useRef(activeItem?.id);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.roadmaps(), api.stories()])
      .then(([roadmapResults, storyResults]) => {
        if (cancelled) return;
        const loadedRoadmaps = roadmapResults.map(normalizePost);
        const loadedStories = storyResults.map(normalizePost);
        setRoadmaps(loadedRoadmaps);
        setStories(loadedStories);
        setActiveItem(loadedRoadmaps[0] || loadedStories[0] || null);
      })
      .catch((error) => {
        if (!cancelled) setFeedError(error.message);
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeItemId = activeItem?.id;
  useEffect(() => {
    activeItemIdRef.current = activeItemId;
  }, [activeItemId]);

  useEffect(() => {
    if (!activeItemId) return undefined;
    let cancelled = false;
    api.comments(activeItemId)
      .then((result) => {
        if (!cancelled) {
          setComments(result);
          setCommentsLoadedFor(activeItemId);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setComments([]);
          setCommentsLoadedFor(activeItemId);
          setActionError(error.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeItemId]);

  useEffect(() => {
    const username = profileUsernameOverride
      || activeItem?.author_profile?.username
      || "shashank.dev";
    let cancelled = false;
    api.profile(username)
      .then((profile) => {
        if (!cancelled) {
          setViewedProfile({
            ...profile,
            posts: (profile.posts || []).map(normalizePost),
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setViewedProfile({
            ...emptyProfile,
            username,
            name: activeItem?.author || "Profile",
          });
          if (!feedError) setActionError(error.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeItem?.author_profile?.username, activeItem?.author, feedError, profileUsernameOverride]);

  const relatedStories = useMemo(
    () =>
      activeItem?.type === "roadmap"
        ? stories.filter((story) => story.roadmapId === activeItem.id)
        : [],
    [activeItem, stories],
  );

  const profileUsername = profileUsernameOverride
    || activeItem?.author_profile?.username
    || "shashank.dev";
  const profileForActiveItem = viewedProfile.username === profileUsername
    ? viewedProfile
    : {
      ...(activeItem?.author_profile || emptyProfile),
      posts: [],
    };
  const visiblePosts = (profileForActiveItem.posts || []).filter((post) => (
    profileFilter === "all" || post.type === profileFilter
  ));
  const commentsForActivePost =
    commentsLoadedFor === activeItemId ? comments : [];
  const commentsLoading = Boolean(activeItemId && commentsLoadedFor !== activeItemId);

  function openItem(item) {
    if (item?.id !== activeItem?.id) setNewComment("");
    setActiveItem(item);
    setProfileUsernameOverride(null);
    setActionError("");
  }

  function updatePost(postId, updates) {
    const updateCollection = (current) => current.map((post) => (
      post.id === postId ? { ...post, ...updates } : post
    ));
    setRoadmaps(updateCollection);
    setStories(updateCollection);
    setActiveItem((current) => (
      current?.id === postId ? { ...current, ...updates } : current
    ));
  }

  function countVisibleComments(commentList) {
    return commentList.reduce(
      (total, comment) => total
        + (comment.is_deleted ? 0 : 1)
        + countVisibleComments(comment.replies || []),
      0,
    );
  }

  async function submitComment(parentId, text) {
    const postId = activeItemIdRef.current;
    if (!postId) return;
    setActionError("");
    try {
      const updatedComments = await api.createComment(postId, text, parentId);
      updatePost(postId, { comment_count: countVisibleComments(updatedComments) });
      if (activeItemIdRef.current === postId) {
        setComments(updatedComments);
        setCommentsLoadedFor(postId);
        setNewComment("");
      }
    } catch (error) {
      if (activeItemIdRef.current === postId) {
        setActionError(
          !user && (error.status === 401 || error.status === 403)
            ? "Log in to submit a comment."
            : error.message,
        );
      }
    }
  }

  async function deleteComment(commentId) {
    const postId = activeItemIdRef.current;
    if (!postId) return;
    setActionError("");
    try {
      await api.deleteComment(commentId);
      const updatedComments = await api.comments(postId);
      updatePost(postId, { comment_count: countVisibleComments(updatedComments) });
      if (activeItemIdRef.current === postId) {
        setComments(updatedComments);
        setCommentsLoadedFor(postId);
      }
    } catch (error) {
      if (activeItemIdRef.current === postId) setActionError(error.message);
    }
  }

  const floatingNav = (
    <FloatingNav
      menuOpen={menuOpen}
      onToggleMenu={() => setMenuOpen((open) => !open)}
      onOpenCreate={() => setCreationOpen(true)}
      onOpenStories={() => setRightPanel("stories")}
      onOpenExplore={() => {
        setActiveItem(null);
        setRightPanel("comments");
        setActionError("");
      }}
      onOpenProfile={() => setRightPanel("profile")}
      onViewFullProfile={() => {
        if (user) {
          setProfileUsernameOverride(user.username);
          setRightPanel("profile");
        }
      }}
    />
  );

  const leftPanel = (
    <FeedPanel
      activeFeed={activeFeed}
      activeItem={activeItem}
      roadmaps={roadmaps}
      stories={stories}
      loading={feedLoading}
      error={feedError}
      onFeedChange={setActiveFeed}
      onOpenItem={openItem}
      onOpenRoadmap={setViewingRoadmap}
      onOpenComments={(item) => {
        openItem(item);
        setRightPanel("comments");
      }}
      onLikeChange={updatePost}
    />
  );

  const rightPanelView = (
    <aside className="right-panel">
      <header className="right-top">
        <div className="liquid-group" role="group" aria-label="Workspace view">
          {[
            ["comments", "Comments"],
            ["storyline", "Storyline"],
            ["stories", "Stories"],
            ["profile", "Profile"],
            ["games", "Games"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={rightPanel === value ? "active" : ""}
              onClick={() => setRightPanel(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {rightPanel === "comments" && (
        <CommentSection
          activeItem={activeItem}
          comments={commentsForActivePost}
          loading={commentsLoading}
          error={actionError}
          newComment={newComment}
          onCommentChange={setNewComment}
          onCommentSubmit={() => submitComment(undefined, newComment.trim())}
          onReply={submitComment}
          onDelete={deleteComment}
        />
      )}

      {rightPanel === "storyline" && (
        <RoadmapDetail
          activeItem={activeItem}
          relatedStories={relatedStories}
          onSelectStory={(story) => {
            openItem(story);
            setRightPanel("stories");
          }}
          onOpenRoadmap={() => setRightPanel("storyline")}
        />
      )}

      {rightPanel === "stories" && (
        <StoryDetail
          activeItem={activeItem}
          roadmaps={roadmaps}
          onSelectRoadmap={(roadmap) => {
            openItem(roadmap);
            setRightPanel("storyline");
          }}
        />
      )}

      {rightPanel === "profile" && (
        <ProfileView
          viewedProfile={profileForActiveItem}
          profileFilter={profileFilter}
          visiblePosts={visiblePosts}
          profilePostCount={(profileForActiveItem.posts || []).length}
          onProfileFilterChange={setProfileFilter}
          onSelectPost={(post) => {
            openItem(post);
            setRightPanel(post.type === "story" ? "stories" : "comments");
          }}
        />
      )}

      {rightPanel === "games" && (
        <div className="right-content game-panel">
          <div className="view-heading">
            <span>INDEPENDENT SPACE</span>
            <h2>Games</h2>
            <p>Games live separately from roadmaps and stories.</p>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <>
      <MainLayout
        floatingNav={floatingNav}
        leftPanel={leftPanel}
        rightPanel={rightPanelView}
      />
      {creationOpen && (
        <PostCreationOverlay
          onClose={() => setCreationOpen(false)}
          onPublished={(post) => {
            const savedPost = normalizePost(post);
            if (savedPost.type === "roadmap") {
              setRoadmaps((current) => [savedPost, ...current.filter((item) => item.id !== savedPost.id)]);
            } else {
              setStories((current) => [savedPost, ...current.filter((item) => item.id !== savedPost.id)]);
            }
            openItem(savedPost);
          }}
        />
      )}
      {viewingRoadmap && (
        <RoadmapViewerOverlay
          key={viewingRoadmap.id}
          roadmap={viewingRoadmap}
          onClose={() => setViewingRoadmap(null)}
        />
      )}
    </>
  );
}

export default App;
