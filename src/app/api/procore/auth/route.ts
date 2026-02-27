import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.PROCORE_CLIENT_ID;
  const redirectUri =
    process.env.PROCORE_REDIRECT_URI ||
    `${request.nextUrl.origin}/api/procore/callback`;
  const authUrl = process.env.PROCORE_AUTH_URL;

  if (!clientId || !redirectUri || !authUrl) {
    return NextResponse.json(
      { error: "Procore OAuth configuration is missing" },
      { status: 500 },
    );
  }

  const authorizationUrl = new URL(authUrl);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(authorizationUrl);
}
