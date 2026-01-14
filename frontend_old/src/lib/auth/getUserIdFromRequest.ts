import { cookies } from "next/headers";

export function getUserIdFromRequestOrThrow(): string {
  const userId = cookies().get("cookedai_user_id")?.value;
  if (!userId) {
    throw new Error("NO_AUTH");
  }
  return userId;
}
