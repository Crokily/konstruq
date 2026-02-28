import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function resolveAppUserId(clerkUserId: string): Promise<string | null> {
  let [appUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!appUser) {
    await db
      .insert(users)
      .values({ clerkId: clerkUserId, email: "unknown@konstruq.app" })
      .onConflictDoNothing({ target: users.clerkId });

    [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
  }

  return appUser?.id ?? null;
}
