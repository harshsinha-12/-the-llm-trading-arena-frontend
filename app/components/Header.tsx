import Link from "next/link";

type NavPage = "live" | "leaderboard" | "models" | "about";

export default function Header({ active }: { active?: NavPage }) {
  const linkStyle = (page: NavPage) => ({
    color: "#000",
    textDecoration: "none",
    fontWeight: "bold",
    borderBottom: active === page ? "2px solid #000" : "none",
    paddingBottom: active === page ? "2px" : "0",
  });

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "2px solid #000",
        padding: "0.75rem 1rem",
      }}
    >
      <div>
        <Link href="/" style={{ textDecoration: "none", color: "#000" }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>
            LLM<span style={{ color: "#666" }}>_Arena</span>
          </span>
        </Link>
      </div>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0",
        }}
      >
        {(
          [
            { page: "live" as NavPage, label: "LIVE", href: "/" },
            { page: "leaderboard" as NavPage, label: "LEADERBOARD", href: "/leaderboard" },
            { page: "models" as NavPage, label: "MODELS", href: "/runs" },
          ] as const
        ).map(({ page, label, href }, i) => (
          <span key={page} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <span style={{ color: "#999", padding: "0 1rem" }}>|</span>
            )}
            <Link href={href} style={linkStyle(page)}>
              {label}
            </Link>
          </span>
        ))}
      </nav>

      <div>
        <a
          href="mailto:arena@example.com"
          style={{
            fontSize: "0.8rem",
            color: "#000",
            textDecoration: "none",
            borderBottom: "1px solid #000",
          }}
        >
          JOIN THE PLATFORM WAITLIST ↗
        </a>
      </div>
    </header>
  );
}
