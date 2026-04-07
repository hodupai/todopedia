"use client";

import Image from "next/image";
import { useTheme } from "@/components/ThemeProvider";

export default function BgImage() {
  const { bgKey } = useTheme();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10" style={{ opacity: 0.15 }}>
      <Image
        src={`/ui/${bgKey}.webp`}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
    </div>
  );
}
