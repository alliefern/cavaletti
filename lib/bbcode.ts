// Tiny, safe BBCode → HTML. Everything is escaped first; only whitelisted tags come back.

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const safeUrl = (u: string) => (/^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null);

export function bbcode(input: string): string {
  let s = escape(input);
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>");
  s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>");
  s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>");
  s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<s>$1</s>");
  s = s.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="bb-center">$1</div>');
  s = s.replace(/\[color=(#[0-9a-f]{3,6}|[a-z]{3,20})\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>');
  s = s.replace(/\[size=(small|large|huge)\]([\s\S]*?)\[\/size\]/gi, '<span class="bb-$1">$2</span>');
  s = s.replace(/\[quote(?:=([^\]]{1,40}))?\]([\s\S]*?)\[\/quote\]/gi, (_m, who, body) =>
    `<blockquote class="bb-quote">${who ? `<cite>${who} wrote:</cite>` : ""}${body}</blockquote>`,
  );
  s = s.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_m, u) => {
    const url = safeUrl(u.replace(/&amp;/g, "&"));
    return url ? `<img class="bb-img" src="${escape(url)}" alt="" loading="lazy" />` : "";
  });
  s = s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_m, u, text) => {
    const url = safeUrl(u.replace(/&amp;/g, "&"));
    return url ? `<a href="${escape(url)}" rel="nofollow noopener" target="_blank">${text}</a>` : text;
  });
  s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_m, u) => {
    const url = safeUrl(u.replace(/&amp;/g, "&"));
    return url ? `<a href="${escape(url)}" rel="nofollow noopener" target="_blank">${u}</a>` : u;
  });
  // [horse]CV-000123[/horse] or a horse UUID → link to the horse page
  s = s.replace(/\[horse\]([0-9a-f-]{36})\[\/horse\]/gi, '<a href="/horses/$1">🐴 view horse</a>');
  return s.replace(/\n/g, "<br />");
}
