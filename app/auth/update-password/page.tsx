import { updatePassword } from "@/app/auth/actions";
import { Flash, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { requireViewer } from "@/lib/session";

export const metadata = { title: "Set password" };

export default async function UpdatePasswordPage({ searchParams }: { searchParams: SP }) {
  await requireViewer("/auth/update-password");
  const sp = await searchParams;
  return (
    <div className="auth-card">
      <h1>Set a new password</h1>
      <Flash sp={sp} />
      <div className="box">
        <div className="box-body">
          <form action={updatePassword} className="stack">
            <div className="field">
              <label htmlFor="password">New password</label>
              <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm</label>
              <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <SubmitButton>Save password</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
