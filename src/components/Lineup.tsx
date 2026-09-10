import type { RatedPlayer, RatedMarketPlayer } from "@/lib/advisor";
import type { Replacement } from "@/lib/lineup";
import { eur, playerImage } from "@/lib/fields";
import { PlayerPhoto } from "./Media";
import { PrognosisFlag, StatusFlag } from "./ui";

/* -------------------------------------------------- Aktuelle Aufstellung */

export function CurrentLineup({ starters }: { starters: RatedPlayer[] | null }) {
  if (!starters) {
    return (
      <p className="rounded-card border border-kb-line bg-kb-surface/90 px-4 py-3 text-data-xs leading-relaxed text-kb-grey">
        Deine gesetzte Aufstellung gibt die Kickbase-API nicht her – die
        Empfehlungen unten vergleichen deshalb gegen die oben berechnete beste
        Elf. Sobald der Endpunkt bekannt ist, tritt hier deine echte Startelf an
        ihre Stelle.
      </p>
    );
  }
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-kb-line px-4 py-3">
        <h2 className="display text-base">Deine aktuelle Aufstellung</h2>
      </div>
      <ul className="divide-y divide-kb-line/70">
        {starters.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
            <PlayerPhoto src={playerImage(p.image)} name={p.fullName} size={30} />
            <span className="min-w-0 flex-1 truncate font-semibold">{p.fullName}</span>
            <StatusFlag status={p.status} />
            <PrognosisFlag prognosis={p.prognosis} />
            <span className="num text-data-sm text-kb-grey-light">Ø {p.average.toFixed(0)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------- Wechsel-Empfehlungen */

export function Replacements({
  swaps,
  referenceIsReal,
}: {
  swaps: Replacement<RatedPlayer, RatedMarketPlayer>[];
  /** Vergleicht gegen die echte gesetzte Elf (true) oder die berechnete (false). */
  referenceIsReal: boolean;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-kb-line px-4 py-3">
        <h2 className="display text-base">Vom Markt: Elf verstärken</h2>
        <span className="label">Größter Zugewinn zuerst</span>
      </div>

      {swaps.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="display text-base">Der Markt bringt dich gerade nicht weiter</p>
          <p className="mx-auto mt-2 max-w-md text-body text-kb-grey">
            Kein Marktspieler schlägt einen deiner{" "}
            {referenceIsReal ? "aufgestellten" : "empfohlenen"} Stammspieler auf
            seiner Position deutlich genug – zumindest nicht bezahlbar.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-kb-line/70">
          {swaps.map((s) => (
            <li
              key={`${s.out.id}-${s.incoming.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              {/* Raus */}
              <div className="flex min-w-0 items-center gap-2">
                <PlayerPhoto src={playerImage(s.out.image)} name={s.out.fullName} size={32} />
                <div className="min-w-0">
                  <div className="truncate text-data-sm text-kb-grey-light line-through decoration-kb-grey/60">
                    {s.out.name}
                  </div>
                  <div className="num text-data-xs text-kb-grey">Ø {s.out.average.toFixed(0)}</div>
                </div>
              </div>

              <span aria-hidden className="text-kb-red">→</span>

              {/* Rein */}
              <div className="flex min-w-0 items-center gap-2">
                <PlayerPhoto
                  src={playerImage(s.incoming.image)}
                  name={s.incoming.fullName}
                  size={32}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-data-sm font-semibold text-kb-white">
                      {s.incoming.name}
                    </span>
                    <StatusFlag status={s.incoming.status} />
                    <PrognosisFlag prognosis={s.incoming.prognosis} />
                  </div>
                  <div className="num text-data-xs text-kb-grey">
                    Ø {s.incoming.average.toFixed(0)}
                  </div>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-x-5 gap-y-1">
                <div className="text-right">
                  <div className="num text-data-sm font-bold text-kb-white">
                    +{s.improvement.toFixed(0)}
                  </div>
                  <div className="label">Zugewinn Ø</div>
                </div>
                <div className="text-right">
                  <div className="num text-data-sm font-semibold text-kb-grey-light">
                    {eur(s.incoming.price)}
                  </div>
                  <div className="label">Preis</div>
                </div>
                <div className="text-right">
                  <div
                    className={`num text-data-sm font-semibold ${
                      s.netCost <= 0 ? "text-kb-white" : "text-kb-grey-light"
                    }`}
                  >
                    {s.netCost < 0 ? "+" : ""}
                    {eur(Math.abs(s.netCost))}
                  </div>
                  <div className="label">Netto nach Verkauf</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
