export default function PrivacyPage() {
  return (
    <main style={{
      minHeight: "100vh",
      padding: "40px 20px",
      background: "#050504",
      color: "#f5f0df",
      fontFamily: "system-ui, sans-serif",
      lineHeight: 1.8,
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1>NUTS Privacy Policy</h1>
        <p>Last updated: June 12, 2026</p>

        <h2>1. Overview</h2>
        <p>
          NUTS is a puzzle card game provided by chxsedorf.
          This Privacy Policy explains how NUTS handles user information.
        </p>

        <h2>2. Information We Collect</h2>
        <p>
          NUTS may collect a player name, player ID, score, ranking data, and basic technical information necessary to operate the game and leaderboard.
        </p>

        <h2>3. How We Use Information</h2>
        <p>
          The collected information is used to provide game features, save scores, display rankings, improve the game, and maintain service functionality.
        </p>

        <h2>4. Third-Party Services</h2>
        <p>
          NUTS may use third-party services such as Vercel and Supabase to host the app and manage leaderboard data.
          These services may process data according to their own privacy policies.
        </p>

        <h2>5. Data Sharing</h2>
        <p>
          We do not sell personal information. Ranking information such as player name and score may be displayed to other users within the game.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          Leaderboard data may be retained as long as necessary to provide the ranking feature.
        </p>

        <h2>7. Children</h2>
        <p>
          NUTS is not specifically directed to children under 13.
        </p>

        <h2>8. Contact</h2>
        <p>
          For questions about this Privacy Policy, please contact the developer.
        </p>

        <p>
          Developer: chxsedorf
        </p>
      </div>
    </main>
  );
}