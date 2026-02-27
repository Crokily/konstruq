import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { dataConnections, users } from "@/lib/db/schema";
import type { ProcoreTokens } from "@/lib/types/procore";

interface ProcoreCompany {
  id: number | string;
}

interface ProcoreConnectionCredentials {
  accessToken: string;
  refreshToken: string;
  companyId: string;
  expiresAt: string;
}

const PROCORE_PROVIDER = "procore";
const PROCORE_CONNECTION_NAME = "Procore";

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing OAuth authorization code" },
      { status: 400 },
    );
  }

  const clientId = process.env.PROCORE_CLIENT_ID;
  const clientSecret = process.env.PROCORE_CLIENT_SECRET;
  const redirectUri =
    process.env.PROCORE_REDIRECT_URI ||
    `${request.nextUrl.origin}/api/procore/callback`;
  const tokenUrl = process.env.PROCORE_TOKEN_URL;
  const apiBaseUrl = process.env.PROCORE_API_BASE_URL;

  if (!clientId || !clientSecret || !redirectUri || !tokenUrl || !apiBaseUrl) {
    return NextResponse.json(
      { error: "Procore OAuth configuration is missing" },
      { status: 500 },
    );
  }

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const tokenErrorText = await tokenResponse.text();
      return NextResponse.json(
        {
          error: "Failed to exchange authorization code for token",
          details: tokenErrorText,
        },
        { status: 502 },
      );
    }

    const tokenPayload = (await tokenResponse.json()) as Partial<ProcoreTokens>;
    const accessToken = tokenPayload.access_token;
    const refreshToken = tokenPayload.refresh_token;

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: "Token response from Procore is missing required fields" },
        { status: 502 },
      );
    }

    const issuedAtSeconds =
      typeof tokenPayload.created_at === "number"
        ? tokenPayload.created_at
        : Math.floor(Date.now() / 1000);
    const expiresInSeconds =
      typeof tokenPayload.expires_in === "number" ? tokenPayload.expires_in : 0;
    const expiresAt = new Date(
      (issuedAtSeconds + expiresInSeconds) * 1000,
    ).toISOString();

    const companiesResponse = await fetch(`${apiBaseUrl}/rest/v1.0/companies`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!companiesResponse.ok) {
      const companyErrorText = await companiesResponse.text();
      return NextResponse.json(
        {
          error: "Failed to fetch companies from Procore",
          details: companyErrorText,
        },
        { status: 502 },
      );
    }

    const companiesPayload = (await companiesResponse.json()) as unknown;
    const companies = Array.isArray(companiesPayload)
      ? (companiesPayload as ProcoreCompany[])
      : [];
    const companyId = companies[0]?.id;

    if (companyId === undefined || companyId === null) {
      return NextResponse.json(
        { error: "No Procore company available for this account" },
        { status: 502 },
      );
    }

    let [appUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!appUser) {
      const clerkUser = await currentUser();

      if (!clerkUser) {
        return NextResponse.json(
          { error: "Unable to load current Clerk user" },
          { status: 401 },
        );
      }

      const primaryEmail =
        clerkUser.primaryEmailAddress?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress;

      if (!primaryEmail) {
        return NextResponse.json(
          { error: "Current Clerk user has no email address" },
          { status: 400 },
        );
      }

      [appUser] = await db
        .insert(users)
        .values({
          clerkId: userId,
          email: primaryEmail,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          imageUrl: clerkUser.imageUrl,
        })
        .returning();
    }

    const credentials: ProcoreConnectionCredentials = {
      accessToken,
      refreshToken,
      companyId: String(companyId),
      expiresAt,
    };

    const [existingConnection] = await db
      .select({ id: dataConnections.id })
      .from(dataConnections)
      .where(
        and(
          eq(dataConnections.userId, appUser.id),
          eq(dataConnections.provider, PROCORE_PROVIDER),
        ),
      )
      .limit(1);

    if (existingConnection) {
      await db
        .update(dataConnections)
        .set({
          name: PROCORE_CONNECTION_NAME,
          credentials,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(dataConnections.id, existingConnection.id));
    } else {
      await db.insert(dataConnections).values({
        userId: appUser.id,
        provider: PROCORE_PROVIDER,
        name: PROCORE_CONNECTION_NAME,
        credentials,
        isActive: true,
      });
    }

    return NextResponse.redirect(
      new URL("/integrations?procore=connected", request.url),
    );
  } catch (error) {
    console.error("Failed to complete Procore callback:", error);
    return NextResponse.json(
      { error: "Failed to complete Procore callback" },
      { status: 500 },
    );
  }
}
