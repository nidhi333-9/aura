import { RAW_SAMPLE_DAYS } from "../utils/retention";

// The privacy notice, in plain words. If the sensor or the server starts collecting or keeping
// something different, change this page in the same commit.

const Section = ({ title, children }) => (
  <section className="mt-10">
    <h2 className="text-xl font-extrabold text-[var(--aura-dark)] tracking-tight mb-3">{title}</h2>
    <div className="text-slate-600 font-medium leading-relaxed flex flex-col gap-3">{children}</div>
  </section>
);

const List = ({ items }) => (
  <ul className="list-disc pl-6 flex flex-col gap-1.5">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

const Privacy = () => (
  <div className="min-h-screen bg-[var(--aura-light)] bg-grid-mesh font-sans">
    <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
      <a href="/" className="text-sm font-bold text-[var(--aura-blue)] hover:opacity-80">
        ← Back to Aura
      </a>
      <h1 className="text-4xl font-extrabold text-[var(--aura-dark)] tracking-tight mt-6">Privacy</h1>
      <p className="text-slate-500 font-medium mt-3">
        Aura is a student project, not a company. This page says in plain words what it collects, where it goes
        and how you can remove it. Last updated 5 October 2026.
      </p>

      <Section title="What the sensor collects">
        <p>While the sensor runs, about every 10 seconds it records:</p>
        <List
          items={[
            "the name of the app in front (for example “Google Chrome” or “Terminal”)",
            "the title of that window. Titles can contain private words, such as an email subject, a chat name or a document name",
            "on a Mac, the name of the website your browser tab is on (for example linkedin.com). Never the full address, and private or incognito windows are skipped",
            "the time",
          ]}
        />
        <p>
          It does <b>not</b> take screenshots, record keystrokes, read passwords or read the content of pages.
        </p>
        <p>
          Some titles are web addresses, and addresses can carry login codes. Before saving, Aura hides everything
          after a “?” or “#” in an address, and anything that looks like a login token.
        </p>
      </Section>

      <Section title="What it is used for">
        <p>
          Each moment is labelled Productive, Neutral, Distraction or Idle. Those labels become your focus score
          and your charts. That is all. Aura does not sell your data and has no ads.
        </p>
      </Section>

      <Section title="Who can see it">
        <p>
          You, when you are signed in: every request is checked against your account, and other Aura users cannot
          see your data.
        </p>
        <p>
          Aura is run by one person, who can technically read the database it is stored in, like the owner of any
          app.
        </p>
      </Section>

      <Section title="Where it is stored">
        <List
          items={[
            "In a MongoDB Atlas database. The server runs on Render and this website on Vercel.",
            "Signing in uses Google. Aura receives your name, email address, profile picture and Google's account id. It never sees your Google password.",
            "The dashboard shows YouTube videos and a Spotify player. Those load from YouTube and Spotify, which can see that your browser asked for them. Aura does not send them your activity.",
          ]}
        />
      </Section>

      <Section title="How long it is kept">
        <p>
          Samples, with their window titles, are deleted automatically after {RAW_SAMPLE_DAYS} days.
        </p>
        <p>
          The daily summaries behind the Week, Month and 3-month charts are kept until you delete them. They hold only
          counts, for each day, of time that was Productive, Neutral or a Distraction. They contain no titles, apps or
          websites.
        </p>
      </Section>

      <Section title="Your controls">
        <List
          items={[
            "On the dashboard, “Your data” shows what Aura holds, lets you download a copy of it, and lets you delete all your tracked data, or your whole account.",
            "The download is one file with your profile, your devices (never their secret keys), your daily summaries and every sample Aura still holds, window titles included. Keep it private.",
            "Deleting your account also removes your paired devices, and their sensors stop by themselves.",
            "“Your devices” lets you remove one sensor at any time.",
            "You can stop the sensor whenever you like (press Ctrl+C in its window). To remove it completely, delete the .aura folder in your home folder.",
          ]}
        />
      </Section>

      <Section title="Questions">
        <p>
          Open an issue at{" "}
          <a
            href="https://github.com/nidhi333-9/aura/issues"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 font-bold text-[var(--aura-blue)]"
          >
            github.com/nidhi333-9/aura
          </a>
          . If this page changes, the date at the top changes too.
        </p>
      </Section>
    </main>
  </div>
);

export default Privacy;
