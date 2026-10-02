import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/session";
import { money } from "@/lib/format";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cavaletti — Horse Sim", template: "%s · Cavaletti" },
  description: "An old-school horse sim. Build your stable, breed your lines, run the shows.",
};

const NAV = [
  ["/", "Home"],
  ["/stables", "Stables"],
  ["/market", "Market"],
  ["/breeding", "Breeding"],
  ["/associations", "Associations"],
  ["/shops", "Shops"],
  ["/forum", "Forum"],
  ["/guide", "Guide"],
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&family=Lora:ital,wght@0,400;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="site">
          <header className="masthead">
            <Link href="/" className="logo">
              <span className="logo-mark" aria-hidden="true">
                ⌒
              </span>
              Cavaletti
            </Link>
            <span className="tagline">est. 2026 · a horse sim, the old-fashioned way</span>
            <div className="userbox">
              {viewer ? (
                <>
                  <Link href="/dashboard" className="userbox-name">
                    {viewer.username}
                  </Link>
                  <Link href="/bank" className="userbox-bal" title="Bank balance">
                    {money(viewer.balance)}
                  </Link>
                  <form action="/auth/signout" method="post">
                    <button className="linkish">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login">Log in</Link>
                  <Link href="/signup" className="btn btn-small">
                    Join free
                  </Link>
                </>
              )}
            </div>
          </header>
          <nav className="mainnav">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
            {viewer && (
              <Link href="/dashboard" className="nav-mine">
                My Barn
              </Link>
            )}
          </nav>
          <main className="content">{children}</main>
          <footer className="footer">
            <p>
              Cavaletti is a game. All money is pretend, all horses are pixels, all drama is real.{" "}
              <Link href="/guide">Player Guide</Link> · <Link href="/forum">Forum</Link>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
