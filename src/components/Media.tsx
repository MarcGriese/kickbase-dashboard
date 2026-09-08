"use client";

import { useState } from "react";

/**
 * Bilder vom Kickbase-CDN.
 *
 * Bewusst als einfaches <img> statt next/image: die CDN-Pfade sind
 * unvollstaendig dokumentiert und aendern sich, und ein 404 soll hier ein
 * ruhiger Platzhalter sein statt eines Serverfehlers. Deshalb liegt das
 * onError-Fallback im Client.
 */

export function PlayerPhoto({
  src,
  name,
  size = 40,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border border-night-700 bg-night-800"
      style={{ width: size, height: size }}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center text-data-xs font-bold text-snow-faint"
        >
          {initials || "–"}
        </span>
      )}
    </div>
  );
}

export function TeamCrest({
  src,
  name,
  size = 18,
  /** Ohne Buchstaben im Platzhalter - wenn daneben schon ein Kuerzel steht. */
  plain = false,
}: {
  src: string | null;
  name: string;
  size?: number;
  plain?: boolean;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-sm bg-night-700 text-[0.6rem] font-bold text-snow-faint"
        style={{ width: size, height: size }}
        title={name}
      >
        {plain ? "" : name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
