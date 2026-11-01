export default function ProfileView({
  viewedProfile,
  profileFilter,
  visiblePosts,
  profilePostCount,
  onProfileFilterChange,
  onSelectPost,
}) {
  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">
          {viewedProfile.name[0].toUpperCase()}
        </div>

        <div className="profile-info">
          <h2>{viewedProfile.username}</h2>
          <strong>{viewedProfile.name}</strong>

          <div className="profile-stats">
            <span>
              <b>{profilePostCount}</b> posts
            </span>
            <span>
              <b>{viewedProfile.followers.toLocaleString()}</b> followers
            </span>
            <span>
              <b>{viewedProfile.following}</b> following
            </span>
          </div>
        </div>
      </div>

      <p className="profile-bio">{viewedProfile.bio}</p>

      <div className="profile-controls">
        <div>
          {[
            ["all", "All posts"],
            ["roadmap", "Roadmaps"],
            ["story", "Stories"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={profileFilter === value ? "active" : ""}
              onClick={() => onProfileFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span>{visiblePosts.length} items</span>
      </div>

      <div className="profile-grid">
        {visiblePosts.map((post) => (
          <button
            key={`${post.type}-${post.id}`}
            className={`profile-grid-item ${post.type}`}
            title={post.title}
            onClick={() => onSelectPost(post)}
          >
            <div className="grid-art">
              <span>{post.type === "roadmap" ? "⌘" : "✎"}</span>
              <small>{post.type.toUpperCase()}</small>
            </div>
            <div className="grid-hover">
              <span>{post.title}</span>
              <small>{post.date}</small>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
