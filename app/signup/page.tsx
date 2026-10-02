import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Join Cavaletti" };

export default async function SignupPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <div className="auth-card">
      <h1>Join Cavaletti</h1>
      <p>
        Free account, <strong>$50,000</strong> in the bank, and one age-up credit. What you do with it is between you and
        your horses.
      </p>
      <Flash sp={sp} />
      <div className="box">
        <div className="box-body">
          <form action={signup} className="stack">
            <div className="field">
              <label htmlFor="username">Username</label>
              <input id="username" name="username" type="text" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" />
              <span className="hint">3–24 characters: letters, numbers, underscores. This is your name on the forum too.</span>
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
              <span className="hint">Only used for logging in and password resets. Never shown to other players.</span>
            </div>
            <div className="fields-2">
              <div className="field">
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm</label>
                <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
              </div>
            </div>
            <SubmitButton>Create account</SubmitButton>
          </form>
          <p className="small">
            Already riding with us? <Link href="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
