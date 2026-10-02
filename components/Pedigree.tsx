import Link from "next/link";
import type { PedNode } from "@/lib/pedigree";
import { regNumber } from "@/lib/format";

function Cell({ node, gen }: { node: PedNode; gen: number }) {
  if (!node) return <span className="ped-unknown">Unrecorded</span>;
  const nameEl = node.id ? <Link href={`/horses/${node.id}`}>{node.name}</Link> : <span>{node.name}</span>;
  return (
    <>
      <span className={`ped-name ped-gen-${gen}`}>{nameEl}</span>
      {node.id && gen < 3 && (
        <span className="ped-meta">
          {[node.breed, node.color, node.reg ? regNumber(node.reg) : null].filter(Boolean).join(" · ")}
        </span>
      )}
    </>
  );
}

export function Pedigree({ gens }: { gens: PedNode[][] }) {
  const depth = gens.length;
  const rows = 2 ** depth;
  return (
    <div className="ped-wrap">
      <table className="pedigree">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {gens.map((nodes, g) => {
                const span = rows / 2 ** (g + 1);
                if (r % span !== 0) return null;
                const i = r / span;
                const side = i % 2 === 0 ? "ped-sire" : "ped-dam";
                return (
                  <td key={g} rowSpan={span} className={side}>
                    <Cell node={nodes[i]} gen={g + 1} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
