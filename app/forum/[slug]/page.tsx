import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThreadPrefix } from "@/components/ThreadPrefix";
import { dateTime } from "@/lib/format";

const PAGE = 40;

export default async function Category({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const supabase = await createClient();
  const { data: cat } = await supabase.from("forum_categories").select("*").eq("slug", slug).maybeSingle();
  if (!cat) notFound();
  const { data: threads, count } = await supabase
    .from("forum_threads")
    .select(
      "id, title, kind, pinned, locked, post_count, created_at, last_post_at, show_status, author:profiles!forum_threads_author_id_fkey(username), last:profiles!forum_threads_last_post_by_fkey(username)",
      { count: "exact" },
    )
    .eq("category_id", cat.id)
    .order("pinned", { ascending: false })
    .order("last_post_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  return (
    <>
      <p className="small">
        <Link href="/forum">Forum</Link> › {cat.section}
      </p>
      <div className="spread">
        <h1 className="mt0" style={{ marginBottom: 0 }}>
          {cat.name}
        </h1>
        {!cat.admin_only && (
          <Link href={`/forum/new?category=${cat.slug}&kind=${cat.default_kind}`} className="btn btn-small">
            + New {cat.default_kind === "show" ? "show" : cat.default_kind === "sale" ? "sale ad" : cat.default_kind === "stud" ? "stud ad" : "thread"}
          </Link>
        )}
      </div>
      <p className="muted">{cat.description}</p>
      {threads?.length ? (
        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th>Thread</th>
                <th className="num">Replies</th>
                <th>Last post</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t: any) => (
                <tr key={t.id}>
                  <td>
                    <ThreadPrefix kind={t.kind} pinned={t.pinned} />
                    {t.locked && <span title="Locked">🔒 </span>}
                    <Link href={`/forum/t/${t.id}`}>
                      <strong>{t.title}</strong>
                    </Link>
                    {t.kind === "show" && t.show_status && <span className="pill" style={{ marginLeft: 6 }}>{t.show_status}</span>}
                    <div className="small muted">
                      by {t.author?.username ?? "Cavaletti Staff"} · {dateTime(t.created_at)}
                    </div>
                  </td>
                  <td className="num">{Math.max(0, t.post_count - 1)}</td>
                  <td className="small nowrap">
                    {dateTime(t.last_post_at)}
                    <div className="muted">{t.last?.username ?? "Staff"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No threads yet. Break the ice.</div>
      )}
      {pages > 1 && (
        <p className="row">
          {Array.from({ length: pages }).map((_, i) => (
            <Link key={i} href={`/forum/${slug}?page=${i + 1}`} className={`btn btn-small ${i + 1 === page ? "" : "btn-ghost"}`}>
              {i + 1}
            </Link>
          ))}
        </p>
      )}
    </>
  );
}
