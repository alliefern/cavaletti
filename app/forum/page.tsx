import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Forum" };

export default async function Forum() {
  const supabase = await createClient();
  const [{ data: cats }, { data: recent }] = await Promise.all([
    supabase.from("forum_categories").select("*, forum_threads(count)").order("sort"),
    supabase
      .from("forum_threads")
      .select("id, title, category_id, last_post_at, last:profiles!forum_threads_last_post_by_fkey(username)")
      .order("last_post_at", { ascending: false })
      .limit(300),
  ]);

  const latestByCat = new Map<number, any>();
  recent?.forEach((t: any) => {
    if (!latestByCat.has(t.category_id)) latestByCat.set(t.category_id, t);
  });
  const sections: string[] = [];
  cats?.forEach((c: any) => {
    if (!sections.includes(c.section)) sections.push(c.section);
  });

  return (
    <>
      <div className="spread">
        <h1 className="mt0">The Cavaletti Forum</h1>
        <Link href="/forum/new" className="btn btn-small">
          + New thread
        </Link>
      </div>
      <p className="muted">
        Same login as the main site. Sales, shows, stud ads, barn life, and the occasional existential crisis about
        footing.
      </p>
      {sections.map((section) => (
        <div className="forum-section" key={section}>
          <div className="table-wrap">
            <table className="list forum-cat">
              <thead>
                <tr>
                  <th>{section}</th>
                  <th className="num">Threads</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {cats
                  ?.filter((c: any) => c.section === section)
                  .map((c: any) => {
                    const last = latestByCat.get(c.id);
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/forum/${c.slug}`} className="cat-name">
                            {c.name}
                          </Link>
                          <div className="small muted">{c.description}</div>
                        </td>
                        <td className="num">{c.forum_threads?.[0]?.count ?? 0}</td>
                        <td className="small">
                          {last ? (
                            <>
                              <Link href={`/forum/t/${last.id}`}>{last.title.slice(0, 40)}</Link>
                              <div className="muted">
                                {dateTime(last.last_post_at)}
                                {last.last?.username && <> · {last.last.username}</>}
                              </div>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
