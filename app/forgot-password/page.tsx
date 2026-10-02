import Link from "next/link";
import { forgotPassword } from "@/app/auth/actions";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Reset password" };

export default async function ForgotPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <div className="auth-card">
      <h1>Reset your password</h1>
      <Flash sp={sp} />
      <div className="box">
        <div className="box-body">
          <form action={forgotPassword} className="stack">
            <div className="field">
              <label htmlFor="email">Email on your account</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <SubmitButton>Send reset link</SubmitButton>
          </form>
          <p className="small">
            <Link href="/login">Back to log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
