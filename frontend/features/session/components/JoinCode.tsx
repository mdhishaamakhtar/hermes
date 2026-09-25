"use client";

import { useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { duration, ease, stagger } from "@/lib/motion";

const PLACEHOLDER = "······";

const SIZES = {
  /** The lobby, read from the back of a room. */
  hero: "h-[clamp(4.5rem,11vw,7.5rem)] text-[clamp(2.75rem,7.5vw,5.25rem)] gap-2 sm:gap-3",
  /** A strip on the live stage, for latecomers. */
  strip: "h-14 text-3xl gap-1.5",
} as const;

/**
 * The join code as the room sees it: six mono cells, slashed zero and all,
 * so "0" and "O" never get confused from across a hall. The cells land one
 * after another when the code first appears.
 */
export function JoinCodeDisplay({
  code,
  size = "hero",
}: {
  code: string;
  size?: keyof typeof SIZES;
}) {
  const characters = (code || PLACEHOLDER).split("");
  return (
    <div
      className={`grid grid-cols-6 font-mono font-semibold text-foreground ${SIZES[size]}`}
      aria-label={
        code ? `Join code ${code.split("").join(" ")}` : "Join code loading"
      }
      role="img"
    >
      {characters.map((character, index) => (
        <motion.span
          key={`${index}-${character}`}
          aria-hidden
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: duration.stage,
            delay: stagger(index),
            ease: ease.out,
          }}
          className="flex h-full items-center justify-center border border-border-strong bg-background"
        >
          {character}
        </motion.span>
      ))}
    </div>
  );
}

const noSubscribe = () => () => {};

/** The public join URL for this deployment, known only in the browser. */
function useJoinUrl(code: string) {
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
  return {
    display: origin ? `${new URL(origin).host}/join` : "/join",
    withCode: `${origin}/join?code=${encodeURIComponent(code)}`,
  };
}

async function copy(text: string, confirmation: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(confirmation);
  } catch {
    toast.error("Couldn't copy. Select it and copy by hand.");
  }
}

/** Where players go, and one-tap ways to share it. */
export function JoinInstructions({ code }: { code: string }) {
  const url = useJoinUrl(code);
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center text-lg text-muted">
        Go to <span className="font-mono text-foreground">{url.display}</span>{" "}
        and enter
      </p>
      <JoinCodeDisplay code={code} />
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          size="sm"
          icon="copy"
          disabled={!code}
          onClick={() => void copy(code, "Join code copied")}
        >
          Copy code
        </Button>
        <Button
          size="sm"
          icon="link"
          disabled={!code}
          onClick={() => void copy(url.withCode, "Join link copied")}
        >
          Copy join link
        </Button>
      </div>
    </div>
  );
}
