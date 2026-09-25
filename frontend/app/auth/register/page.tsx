import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/AuthForms";

export const metadata: Metadata = {
  title: "Create a host account",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <RegisterForm next={typeof next === "string" ? next : null} />;
}
