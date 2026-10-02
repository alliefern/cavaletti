// Shared cosmetic fields for creating/editing a horse.
export function HorseFields({ h }: { h?: any }) {
  return (
    <>
      <div className="fields-2">
        <div className="field">
          <label htmlFor="color">Color</label>
          <input id="color" name="color" defaultValue={h?.color ?? ""} maxLength={60} placeholder="Bay, palomino, blue roan…" />
        </div>
        <div className="field">
          <label htmlFor="markings">Markings</label>
          <input id="markings" name="markings" defaultValue={h?.markings ?? ""} maxLength={200} placeholder="Star, snip, two hind socks" />
        </div>
      </div>
      <div className="fields-3">
        <div className="field">
          <label htmlFor="height">Height (hands)</label>
          <input id="height" name="height" type="number" step="0.1" min={6} max={20} defaultValue={h?.height_hands ?? ""} placeholder="15.2" />
        </div>
        <div className="field">
          <label htmlFor="discipline">Discipline</label>
          <input id="discipline" name="discipline" defaultValue={h?.discipline ?? ""} maxLength={80} placeholder="Hunter, reining, racing…" />
        </div>
        <div className="field">
          <label htmlFor="personality">Personality</label>
          <input id="personality" name="personality" defaultValue={h?.personality ?? ""} maxLength={120} placeholder="Sassy, cuddly, a menace" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="blurb">Blurb</label>
        <input id="blurb" name="blurb" defaultValue={h?.blurb ?? ""} maxLength={300} placeholder="One line that sells this horse." />
      </div>
      <div className="field">
        <label htmlFor="about">About</label>
        <textarea id="about" name="about" defaultValue={h?.about ?? ""} rows={7} maxLength={8000} placeholder="History, show record, quirks, favorite treats…" />
      </div>
      <div className="field">
        <label htmlFor="image">Photo / art</label>
        <input id="image" name="image" type="file" accept="image/*" />
        <span className="hint">PNG, JPG, GIF, or WebP up to 4 MB. Only use images you made or have the rights to.</span>
      </div>
    </>
  );
}
