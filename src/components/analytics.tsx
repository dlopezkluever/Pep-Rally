"use client";
import { useEffect } from "react";
import type { Audience } from "@/lib/domain";
export function Analytics({
  audience,
  event = "page_view",
}: {
  audience: Audience;
  event?: "page_view" | "zero_result";
}) {
  useEffect(() => {
    const send = (name: string) =>
      navigator.sendBeacon(
        "/api/events",
        new Blob([JSON.stringify({ event: name, audience })], {
          type: "application/json",
        }),
      );
    send(event);
    const click = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const a = e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#ref-")) send("citation_click");
      else if (href.includes("/compare")) send("comparison_view");
      else if (href.includes("?area=")) send("area_view");
    };
    const submit = (e: SubmitEvent) => {
      if (
        e.target instanceof HTMLFormElement &&
        e.target.getAttribute("role") === "search"
      )
        send("search");
    };
    document.addEventListener("click", click);
    document.addEventListener("submit", submit);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("submit", submit);
    };
  }, [audience, event]);
  return null;
}
