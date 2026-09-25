import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { StatusScreen } from "@/components/ui/StatusScreen";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main id="main" className="flex flex-1 flex-col">
        <StatusScreen
          code="404"
          status="Off air"
          title="Nothing is broadcasting here"
          description="The link may be broken, or the page may have moved. Check the address, or head somewhere live."
          actions={
            <>
              <ButtonLink href="/" variant="primary" icon="arrow-left">
                Back to Hermes
              </ButtonLink>
              <ButtonLink href="/join">Join a session</ButtonLink>
            </>
          }
        />
      </main>
    </>
  );
}
