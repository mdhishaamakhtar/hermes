"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CODE_LENGTH, CodeInput } from "@/features/join/CodeInput";

/**
 * The player's front door: type the code straight in, then add a name on
 * the join page, which opens with the code already filled.
 */
export function CodeEntry() {
  const router = useRouter();
  const id = useId();
  const [code, setCode] = useState("");
  const complete = code.length === CODE_LENGTH;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (complete) router.push(`/join?code=${code}`);
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor={id} className="text-sm font-medium text-muted">
        Playing? Enter the code from the host&apos;s screen.
      </label>
      <div className="flex max-w-md items-stretch gap-2">
        <CodeInput
          id={id}
          value={code}
          onChange={setCode}
          size="md"
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          variant={complete ? "primary" : "secondary"}
          trailingIcon="arrow-right"
          disabled={!complete}
          className="h-14 shrink-0"
        >
          Join
        </Button>
      </div>
    </form>
  );
}
