"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  IconChevron,
  IconClose,
  IconDoc,
  IconGear,
  IconGrid,
  IconInfo,
  IconMenu,
  IconPlus,
  IconPulse,
  IconSearch,
  IconTags,
} from "./icons";

const MAIN = [
  { href: "/", label: "Overview", icon: IconGrid },
  { href: "/#new-brief", label: "New brief", icon: IconPlus },
  { href: "/briefs", label: "Briefs", icon: IconDoc },
  { href: "/topics", label: "Topics", icon: IconTags },
];
const OTHERS = [
  { href: "/settings", label: "Settings", icon: IconGear },
  { href: "/about", label: "About", icon: IconInfo },
];

function crumb(path: string) {
  if (path === "/") return "Overview";
  if (path.startsWith("/runs/")) return "Run";
  if (path === "/briefs") return "Briefs";
  if (path.startsWith("/briefs/")) return "Brief";
  if (path.startsWith("/topics")) return "Topics";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/about")) return "About";
  return "";
}

function isActive(href: string, path: string) {
  if (href === "/") return path === "/";
  if (href.startsWith("/#")) return false;
  return path === href || path.startsWith(href + "/") || (href === "/briefs" && path.startsWith("/runs/"));
}

function NavGroup({ title, items, path, onNavigate }: { title: string; items: typeof MAIN; path: string; onNavigate: () => void }) {
  return (
    <div className="mt-6">
      <p className="px-3 text-xs text-muted">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, path);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                  active ? "bg-accent/20 text-text" : "text-muted hover:text-text"
                }`}
              >
                <Icon className={active ? "text-accent-2" : ""} />
                <span className="flex-1">{label}</span>
                {active && <IconChevron className="text-accent-2" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col px-3 py-6">
      <Link href="/" className="flex items-center gap-2 px-3 text-base font-semibold" onClick={() => setOpen(false)}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent">
          <IconPulse />
        </span>
        Research Pulse
      </Link>
      <NavGroup title="Main" items={MAIN} path={path} onNavigate={() => setOpen(false)} />
      <NavGroup title="Others" items={OTHERS} path={path} onNavigate={() => setOpen(false)} />
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] border-r border-line bg-surface-2 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-[240px] border-r border-line bg-surface-2">
            <button aria-label="Close menu" className="btn absolute right-3 top-5 p-2" onClick={() => setOpen(false)}>
              <IconClose />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-[220px]">
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-4 sm:px-6">
          <button aria-label="Open menu" className="btn p-2 lg:hidden" onClick={() => setOpen(true)}>
            <IconMenu />
          </button>
          <p className="text-sm text-muted">
            Research <span aria-hidden>/</span> <span className="text-text">{crumb(path)}</span>
          </p>
          <form
            role="search"
            className="order-last w-full sm:order-none sm:ml-auto sm:w-72"
            onSubmit={(e) => {
              e.preventDefault();
              const v = search.current?.value.trim();
              router.push(v ? `/briefs?q=${encodeURIComponent(v)}` : "/briefs");
            }}
          >
            <label htmlFor="global-search" className="sr-only">
              Search briefs
            </label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="global-search"
                ref={search}
                className="input pl-10 pr-12"
                placeholder="Search papers in past briefs"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-line px-1.5 text-xs text-muted">
                ⌘/
              </kbd>
            </div>
          </form>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Link href="/#new-brief" aria-label="New brief" className="btn p-2">
              <IconPlus />
            </Link>
            <Link href="/topics" aria-label="Edit topics" className="btn p-2">
              <IconTags />
            </Link>
            <Link href="/settings" aria-label="Settings" className="btn p-2">
              <IconGear />
            </Link>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
