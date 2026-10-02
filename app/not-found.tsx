import Link from "next/link";

export default function NotFound() {
  return (
    <div className="center" style={{ padding: "40px 0" }}>
      <h1>Jumped the fence</h1>
      <p>Whatever you were looking for got loose. We checked the back pasture.</p>
      <p>
        <Link href="/" className="btn">
          Back to the barn
        </Link>
      </p>
    </div>
  );
}
