import { cookies } from "next/headers";

export async function getUserIdFromRequestOrThrow(): Promise<string> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("cookedai_user_id")?.value;
  if (!userId) {
    throw new Error("NO_AUTH");
  }
  return userId;
}
