"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  Target,
  Rss,
  UsersThree,
  User,
  Gear,
  SignOut,
  CaretUpDown,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  href: string;
  label: string;
  icon: typeof House;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: House },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/feed", label: "Feed", icon: Rss },
  { href: "/social", label: "Social", icon: UsersThree },
];

type SidebarProfile = {
  display_name: string | null;
  username: string | null;
};

type SidebarProps = {
  // Called whenever the user taps something that navigates away. The mobile
  // drawer uses this to close itself; on desktop it's omitted (no-op).
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<SidebarProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      const res = await fetch("/api/profile/me");
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) setProfile(data.profile);
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    onNavigate?.();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = profile?.display_name || profile?.username || "";
  const initials = (profile?.display_name || profile?.username || "??")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="w-60 shrink-0 bg-sidebar border-r border-border flex flex-col h-screen sticky top-0">
      <div className="px-5 pt-6 pb-8">
        <Link href="/" className="brand-wordmark">
          ACCOMPLETE
        </Link>
      </div>

      <nav className="px-3 flex-1">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn("nav-link", active && "is-active")}
                >
                  <Icon size={16} weight={active ? "fill" : "regular"} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-3 px-2 py-1.5 w-full rounded-md hover:bg-accent transition-colors"
            >
              <span className="size-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-mono shrink-0">
                {initials}
              </span>
              <span className="text-sm flex-1 text-left truncate">
                {displayName || " "}
              </span>
              <CaretUpDown size={14} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem asChild disabled={!profile?.username}>
              <Link
                href={profile?.username ? `/profile/${profile.username}` : "#"}
                onClick={onNavigate}
              >
                <User size={14} className="mr-2" />
                View profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/profile/edit" onClick={onNavigate}>
                <Gear size={14} className="mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <SignOut size={14} className="mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
