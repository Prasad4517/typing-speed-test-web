import Link from 'next/link';

export default function LeaderboardPage() {
  return (
    <div className="page-shell shell page-shell--subpage">
      <section className="subpage-heading">
        <div>
          <p className="kicker">A little friendly pressure</p>
          <h1>
            The <em>leaderboard.</em>
          </h1>
        </div>
        <Link className="button button--primary" href="/">
          Practice privately <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="coming-soon-card">
        <span className="coming-soon-card__mark">Soon</span>
        <h2>Leaderboard is coming later.</h2>
        <p>
          We are keeping scores private while anonymous identity and verified
          certificates are being built. A public board will arrive after the
          identity model is ready.
        </p>
        <Link className="button button--primary" href="/results">
          View your progress <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}
