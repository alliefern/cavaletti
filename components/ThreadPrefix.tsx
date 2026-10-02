export function ThreadPrefix({ kind, pinned }: { kind: string; pinned?: boolean }) {
  return (
    <>
      {pinned && <span className="thread-prefix prefix-pinned">Pinned</span>}
      {kind === "sale" && <span className="thread-prefix prefix-sale">For Sale</span>}
      {kind === "stud" && <span className="thread-prefix prefix-stud">At Stud</span>}
      {kind === "show" && <span className="thread-prefix prefix-show">Show</span>}
    </>
  );
}
