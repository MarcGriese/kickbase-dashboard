"use client";

import { useState } from "react";
import { initials, avatarHue } from "@/lib/images";

/**
 * Spielerfoto mit Wappen, beides mit Rueckfallebene.
 *
 * Bewusst ein einfaches <img> statt next/image: Kickbase liefert die Bilder
 * ueber wechselnde CDN-Hosts aus, und next/image verweigert jeden Host, der
 * nicht in next.config.mjs steht - sichtbar als leere Flaeche ohne Fehler.
 * Hier faellt stattdessen ein Platzhalter mit Initialen ein, und die Zeile
 * bleibt lesbar, auch wenn das CDN mal nicht antwortet.
 */
export function PlayerAvatar({
  name,
  photo,
  logo,
  size = 40,
}: {
  name: string;
  photo: string | null;
  logo: string | null;
  size?: number;
}) {
  const [photoDead, setPhotoDead] = useState(false);
  const [logoDead, setLogoDead] = useState(false);

  const showPhoto = photo && !photoDead;
  const showLogo = logo && !logoDead;
  const hue = avatarHue(name);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setPhotoDead(true)}
          className="h-full w-full rounded-full bg-pitch-700 object-cover object-top"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full text-data-xs font-bold"
          style={{
            backgroundColor: `hsl(${hue} 30% 22%)`,
            color: `hsl(${hue} 55% 72%)`,
          }}
        >
          {initials(name)}
        </div>
      )}

      {showLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          width={Math.round(size * 0.45)}
          height={Math.round(size * 0.45)}
          loading="lazy"
          decoding="async"
          onError={() => setLogoDead(true)}
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-pitch-900 object-contain ring-1 ring-pitch-900"
          style={{
            width: Math.round(size * 0.45),
            height: Math.round(size * 0.45),
          }}
        />
      )}
    </div>
  );
}
