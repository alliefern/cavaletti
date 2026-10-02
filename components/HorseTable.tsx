import Link from "next/link";
import { HorseImage } from "./HorseImage";
import { ageLabel, breedingStatus, money, sexIcon, sexLabel } from "@/lib/format";

export type HorseRow = {
  id: string;
  registered_name: string;
  barn_name: string | null;
  sex: string;
  color: string | null;
  birth_date: string;
  age_bonus_years: number;
  status: string;
  image_url: string | null;
  for_sale: boolean;
  sale_price: number | null;
  at_stud: boolean;
  stud_fee: number | null;
  breeds: { name: string } | null;
};

export const HORSE_ROW_SELECT =
  "id, registered_name, barn_name, sex, color, birth_date, age_bonus_years, status, image_url, for_sale, sale_price, at_stud, stud_fee, breeds(name)";

export function HorseTable({ horses, empty = "No horses here yet." }: { horses: HorseRow[]; empty?: string }) {
  if (!horses.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className="list">
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Breed</th>
            <th>Sex</th>
            <th>Age</th>
            <th>Color</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {horses.map((h) => {
            const b = breedingStatus(h);
            return (
              <tr key={h.id}>
                <td style={{ width: 66 }}>
                  <Link href={`/horses/${h.id}`}>
                    <HorseImage src={h.image_url} alt={h.registered_name} size="sm" />
                  </Link>
                </td>
                <td>
                  <Link href={`/horses/${h.id}`}>
                    <strong>{h.registered_name}</strong>
                  </Link>
                  {h.barn_name && <span className="muted small"> “{h.barn_name}”</span>}
                </td>
                <td>{h.breeds?.name}</td>
                <td title={sexLabel(h.sex)}>
                  {sexIcon(h.sex)} {sexLabel(h.sex)}
                </td>
                <td className="nowrap">{ageLabel(h.birth_date, h.age_bonus_years)}</td>
                <td>{h.color}</td>
                <td>
                  <span className="row" style={{ gap: 4 }}>
                    {h.status !== "active" && <span className="pill">{h.status === "record" ? "record only" : h.status}</span>}
                    {h.for_sale && <span className="pill pill-gold">For sale {money(h.sale_price)}</span>}
                    {h.at_stud && <span className="pill pill-green">At stud {money(h.stud_fee)}</span>}
                    {h.status !== "deceased" && h.status !== "record" && h.sex !== "gelding" && (
                      <span className={`pill ${b.ok ? "pill-green" : ""}`}>{b.label}</span>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
