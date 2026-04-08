"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/village", label: "마을", icon: "/ui/icons/map.png" },
  { href: "/collection", label: "도감", icon: "/ui/icons/book.png" },
  { href: "/todo", label: "TODO", icon: "/ui/icons/scroll.png" },
  { href: "/guardian", label: "가디", icon: "/ui/icons/egg.png" },
  { href: "/settings", label: "설정", icon: "/ui/icons/gear.png" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0 border-t"
      style={{ borderColor: "var(--theme-placeholder)" }}
    >
      <ul className="flex h-12 items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-center px-4 py-2"
                style={{ opacity: isActive ? 1 : 0.4 }}
              >
                <img
                  src={item.icon}
                  alt={item.label}
                  className="pixel-art h-8 w-8"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
