import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage(): Promise<never> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tm_token")?.value;
  const role = String(cookieStore.get("tm_role")?.value ?? "").toUpperCase();

  if (!token) {
    redirect("/login");
  }

  if (role === "ADMIN") {
    redirect("/admin/dashboard");
  }

  redirect("/dashboard");
}
