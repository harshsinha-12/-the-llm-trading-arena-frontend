import Link from "next/link";

export type NavPage = "arena" | "rankings" | "simulator" | "docs" | "portfolio" | "trades";

export default function Header({ active }: { active?: NavPage }) {
  return (
    <nav className="landing-nav" aria-label="Primary navigation">
      <div className="landing-nav__left">
        <Link className="landing-brand" href="/">
          LLM ARENA
        </Link>
        <div className="landing-nav__links">
          <Link className={active === "arena" ? "is-active" : ""} href="/">
            ARENA
          </Link>
          <Link className={active === "rankings" ? "is-active" : ""} href="/leaderboard">
            RANKINGS
          </Link>
          <Link className={active === "simulator" ? "is-active" : ""} href="/runs">
            SIMULATOR
          </Link>
          <Link className={active === "docs" ? "is-active" : ""} href="/docs">
            DOCS
          </Link>
        </div>
      </div>
      <div className="landing-nav__actions">
        <button className="landing-button landing-button--secondary">CONNECT WALLET</button>
        <button className="landing-button landing-button--primary">START TRADING</button>
      </div>
    </nav>
  );
}
