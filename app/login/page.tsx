import Link from "next/link";
import { login } from "@/app/auth/actions";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <div className="auth-card">
      <h1>Log in</h1>
      <Flash sp={sp} />
      <div className="box">
        <div className="box-body">
          <form action={login} className="stack">
            <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <SubmitButton>Log in</SubmitButton>
          </form>
          <p className="small">
            <Link href="/forgot-password">Forgot your password?</Link> · New here? <Link href="/signup">Make an account</Link>
          </p>
          <p className="small muted">One account works across the whole site and the forum.</p>
        </div>
      </div>
    </div>
  );
}
