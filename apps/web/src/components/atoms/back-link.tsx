"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";

type BackLinkProps = {
  // Where to go when the user landed on this page cold (no in-app history,
  // e.g. opened a shared link in a new tab). Defaults to Today.
  fallbackHref?: string;
};

// Generic "back" affordance for inner pages. Uses browser history so the
// user lands wherever they came from (Today, Feed, Social, a profile, ...)
// instead of a hardcoded destination per page. If there's no in-app
// history to pop, falls back to `fallbackHref` so the button is never a
// dead-end.
export function BackLink({ fallbackHref = "/" }: BackLinkProps) {
  const router = useRouter();

  function handleClick() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft size={12} />
      <span>Back</span>
    </button>
  );
}
