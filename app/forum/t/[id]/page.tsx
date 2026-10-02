import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { bbcode } from "@/lib/bbcode";
import { buyHorse } from "@/app/actions/horses";
import { editPost, enterShow, moderate, reply, savePlacings, setShowStatus } from "@/app/actions/social";
import { Flash, type SP } from "@/components/Flash";
import { HorseImage } from "@/components/HorseImage";
import { SubmitButton } from "@/components/SubmitButton";
import { ThreadPrefix } from "@/components/ThreadPrefix";
import { ageLabel, date, dateTime, money, sexLabel } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("forum_threads").select("title").eq("id", Number(id) || 0).maybeSingle();
  return { title: data?.title ?? "Thread" };
}

export default async function Thread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const viewer = await getViewer();

  const { data: t } = await supabase
    .from("forum_threads")
    .select(
      "*, forum_categories(slug, name, section), author:profiles!forum_threads_author_id_fkey(username), horses(id, registered_name, sex, birth_date, age_bonus_years, color, image_url, for_sale, sale_price, at_stud, stud_fee, owner_id, breeds(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const isShow = t.kind === "show";
  const isHost = !!viewer && viewer.id === t.author_id;
  const [{ data: posts }, { data: entries }, { data: myHorses }] = await Promise.all([
    supabase
      .from("forum_posts")
      .select("id, body, created_at, edited_at, author_id, profiles(username, display_name, avatar_url, created_at, is_admin, stables(name, launched))")
      .eq("thread_id", id)
      .order("created_at"),
    isShow
      ? supabase
          .from("show_entries")
          .select("id, class_name, place, horse_id, horses(registered_name, breeds(name)), profiles(username)")
          .eq("thread_id", id)
          .order("place", { ascending: true, nullsFirst: false })
          .order("created_at")
      : Promise.resolve({ data: [] as any[] }),
    isShow && viewer
      ? supabase.from("horses").select("id, registered_name").eq("owner_id", viewer.id).eq("status", "active").order("registered_name")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const h = t.horses;
  const classes: string[] = t.show_classes ?? [];

  return (
    <>
      <Flash sp={sp} />
      <p className="small">
        <Link href="/forum">Forum</Link> › <Link href={`/forum/${t.forum_categories?.slug}`}>{t.forum_categories?.name}</Link>
      </p>
      <h1 className="mt0">
        <ThreadPrefix kind={t.kind} pinned={t.pinned} />
        {t.locked && "🔒 "}
        {t.title}
      </h1>

      {h && (t.kind === "sale" || t.kind === "stud") && (
        <div className="box">
          <div className="box-body" style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 14, alignItems: "center" }}>
            <Link href={`/horses/${h.id}`}>
              <HorseImage src={h.image_url} alt={h.registered_name} />
            </Link>
            <div>
              <Link href={`/horses/${h.id}`}>
                <strong style={{ fontSize: "1.1rem" }}>{h.registered_name}</strong>
              </Link>
              <div className="small muted">
                {h.breeds?.name} · {sexLabel(h.sex)} · {ageLabel(h.birth_date, h.age_bonus_years)}
                {h.color && ` · ${h.color}`}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                {t.kind === "sale" &&
                  (h.for_sale ? (
                    <>
                      <strong className="big-number">{money(h.sale_price)}</strong>
                      {viewer && viewer.id !== h.owner_id && (
                        <form action={buyHorse}>
                          <input type="hidden" name="id" value={h.id} />
                          <SubmitButton confirm={`Buy ${h.registered_name} for ${money(h.sale_price)}?`}>Buy now</SubmitButton>
                        </form>
                      )}
                    </>
                  ) : (
                    <span className="pill pill-red">No longer listed (sold or pulled)</span>
                  ))}
                {t.kind === "stud" &&
                  (h.at_stud ? (
                    <>
                      <span>
                        Stud fee <strong>{money(h.stud_fee)}</strong>
                      </span>
                      {viewer && (
                        <Link className="btn btn-brown btn-small" href={`/breeding?sire=${h.id}`}>
                          Book a mare
                        </Link>
                      )}
                    </>
                  ) : (
                    <span className="pill pill-red">Not currently standing</span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isShow && (
        <div className="box">
          <div className="box-title">
            <span>
              Show bill {t.show_date && <>· {date(t.show_date)}</>} · entry {t.entry_fee > 0 ? money(t.entry_fee) : "free"}
            </span>
            <span className={`pill ${t.show_status === "open" ? "pill-green" : t.show_status === "results" ? "pill-gold" : ""}`}>
              {t.show_status === "open" ? "Entries open" : t.show_status === "closed" ? "Entries closed" : "Results posted"}
            </span>
          </div>
          <div className="box-body">
            <div className="grid-2">
              {classes.map((c) => {
                const list = (entries ?? []).filter((e: any) => e.class_name === c);
                return (
                  <div key={c}>
                    <h3 className="mt0">{c}</h3>
                    {list.length ? (
                      <ul className="small" style={{ paddingLeft: 0, marginTop: 0, listStyle: "none" }}>
                        {list.map((e: any) => (
                          <li key={e.id}>
                            <strong style={{ display: "inline-block", minWidth: 22 }}>{e.place ? `${e.place}.` : "–"}</strong>
                            <Link href={`/horses/${e.horse_id}`}>{e.horses?.registered_name}</Link>{" "}
                            <span className="muted">
                              ({e.horses?.breeds?.name}) · {e.profiles?.username}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="small muted mt0">No entries yet.</p>
                    )}
                  </div>
                );
              })}
            </div>

            {viewer && t.show_status === "open" && (
              <form action={enterShow} className="row" style={{ marginTop: 10 }}>
                <input type="hidden" name="thread_id" value={t.id} />
                <select name="horse_id" required style={{ maxWidth: 240 }} defaultValue="">
                  <option value="" disabled>
                    Your horse…
                  </option>
                  {myHorses?.map((mh: any) => (
                    <option key={mh.id} value={mh.id}>
                      {mh.registered_name}
                    </option>
                  ))}
                </select>
                <select name="class_name" required style={{ maxWidth: 240 }} defaultValue="">
                  <option value="" disabled>
                    Class…
                  </option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn btn-small">Enter{t.entry_fee > 0 ? ` (${money(t.entry_fee)})` : ""}</SubmitButton>
              </form>
            )}

            {isHost && (
              <details style={{ marginTop: 14 }}>
                <summary>Host controls</summary>
                <form action={setShowStatus} className="row">
                  <input type="hidden" name="thread_id" value={t.id} />
                  <SubmitButton className="btn btn-small btn-ghost" name="status" value="open">
                    Open entries
                  </SubmitButton>
                  <SubmitButton className="btn btn-small btn-ghost" name="status" value="closed">
                    Close entries
                  </SubmitButton>
                  <SubmitButton className="btn btn-small btn-brown" name="status" value="results">
                    Publish results
                  </SubmitButton>
                </form>
                {(entries?.length ?? 0) > 0 && (
                  <form action={savePlacings} className="stack" style={{ marginTop: 12 }}>
                    <input type="hidden" name="thread_id" value={t.id} />
                    <table className="list small">
                      <thead>
                        <tr>
                          <th>Class</th>
                          <th>Horse</th>
                          <th>Place</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries!.map((e: any) => (
                          <tr key={e.id}>
                            <td>{e.class_name}</td>
                            <td>
                              {e.horses?.registered_name} <span className="muted">({e.profiles?.username})</span>
                            </td>
                            <td style={{ width: 90 }}>
                              <input name={`place_${e.id}`} type="number" min={1} max={100} defaultValue={e.place ?? ""} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <SubmitButton className="btn btn-small">Save placings</SubmitButton>
                  </form>
                )}
              </details>
            )}
          </div>
        </div>
      )}

      {posts?.map((p: any, i: number) => {
        const author = p.profiles;
        const mine = !!viewer && viewer.id === p.author_id;
        return (
          <div className="post" key={p.id} id={i === posts.length - 1 ? "latest" : `p${p.id}`}>
            <div className="post-author">
              {author ? (
                <>
                  <div className="who">
                    <Link href={`/stables/${author.username}`}>{author.username}</Link>
                  </div>
                  {author.is_admin && <span className="pill pill-gold">Staff</span>}
                  {author.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={author.avatar_url} alt="" style={{ width: 90, height: 90, objectFit: "cover", display: "block", margin: "6px 0" }} />
                  )}
                  {author.stables?.launched && <div className="muted">{author.stables.name}</div>}
                  <div className="muted">Joined {date(author.created_at)}</div>
                </>
              ) : (
                <>
                  <div className="who">Cavaletti Staff</div>
                  <span className="pill pill-gold">Staff</span>
                </>
              )}
            </div>
            <div className="post-body">
              <div className="post-meta">
                <span>
                  {dateTime(p.created_at)}
                  {p.edited_at && " · edited"}
                </span>
                <span>#{i + 1}</span>
              </div>
              <div dangerouslySetInnerHTML={{ __html: bbcode(p.body) }} />
              {mine && (
                <details style={{ marginTop: 10 }}>
                  <summary className="small">Edit</summary>
                  <form action={editPost} className="stack">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="thread_id" value={t.id} />
                    <textarea name="body" defaultValue={p.body} rows={6} required maxLength={20000} />
                    <SubmitButton className="btn btn-small">Save edit</SubmitButton>
                  </form>
                </details>
              )}
            </div>
          </div>
        );
      })}

      {viewer?.isAdmin && (
        <form action={moderate} className="row" style={{ marginBottom: 12 }}>
          <input type="hidden" name="thread_id" value={t.id} />
          <input type="hidden" name="pinned" value={t.pinned ? "false" : "true"} />
          <input type="hidden" name="locked" value="" />
          <SubmitButton className="btn btn-small btn-ghost">{t.pinned ? "Unpin" : "Pin"}</SubmitButton>
        </form>
      )}
      {viewer?.isAdmin && (
        <form action={moderate} className="row" style={{ marginBottom: 12 }}>
          <input type="hidden" name="thread_id" value={t.id} />
          <input type="hidden" name="pinned" value="" />
          <input type="hidden" name="locked" value={t.locked ? "false" : "true"} />
          <SubmitButton className="btn btn-small btn-ghost">{t.locked ? "Unlock" : "Lock"}</SubmitButton>
        </form>
      )}

      {t.locked ? (
        <div className="empty">This thread is locked.</div>
      ) : viewer ? (
        <div className="box">
          <div className="box-title">Reply</div>
          <div className="box-body">
            <form action={reply} className="stack">
              <input type="hidden" name="thread_id" value={t.id} />
              <textarea name="body" required rows={6} maxLength={20000} />
              <span className="small muted">BBCode: [b] [i] [u] [quote] [url] [img] [center]</span>
              <SubmitButton>Post reply</SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <p>
          <Link href={`/login?next=/forum/t/${t.id}`}>Log in</Link> to reply.
        </p>
      )}
    </>
  );
}
