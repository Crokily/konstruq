import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function resolveAppUserId(
  clerkId: string,
  email = "unknown@konstruq.app",
): Promise<string | null> {
  let [appUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (appUser) {
    return appUser.id;
  }

  await db
    .insert(users)
    .values({ clerkId, email })
    .onConflictDoNothing({ target: users.clerkId });

  [appUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  return appUser?.id ?? null;
}
