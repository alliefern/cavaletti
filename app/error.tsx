"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="center" style={{ padding: "40px 0" }}>
      <h1>Something spooked</h1>
      <p>Something went wrong on our end. Give it another go.</p>
      <button className="btn" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
