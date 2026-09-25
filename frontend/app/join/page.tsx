import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { JoinForm } from "@/features/join/JoinForm";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code } = await searchParams;
  return (
    <>
      <TopBar>
        <ButtonLink href="/auth/login" variant="ghost" size="sm">
          Host sign in
        </ButtonLink>
      </TopBar>
      <main
        id="main"
        className="flex flex-1 justify-center px-4 pt-14 pb-24 sm:items-center sm:pt-8"
      >
        <div className="w-full max-w-md animate-rise">
          <JoinForm initialCode={typeof code === "string" ? code : ""} />
        </div>
      </main>
    </>
  );
}
