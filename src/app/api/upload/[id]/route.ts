import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { uploadedDatasets, users } from "@/lib/db/schema";

interface DeleteRouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _request: Request,
  context: DeleteRouteContext,
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let [appUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!appUser) {
      [appUser] = await db
        .insert(users)
        .values({ clerkId: userId, email: "unknown@konstruq.app" })
        .returning({ id: users.id });
    }

    if (!appUser) {
      return NextResponse.json(
        { error: "Unable to resolve user" },
        { status: 500 },
      );
    }

    const { id } = await context.params;

    const [dataset] = await db
      .select({ id: uploadedDatasets.id })
      .from(uploadedDatasets)
      .where(
        and(
          eq(uploadedDatasets.id, id),
          eq(uploadedDatasets.userId, appUser.id),
        ),
      )
      .limit(1);

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    await db.delete(uploadedDatasets).where(eq(uploadedDatasets.id, dataset.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete upload route failed:", error);
    return NextResponse.json(
      { error: "Unable to delete dataset right now" },
      { status: 500 },
    );
  }
}
