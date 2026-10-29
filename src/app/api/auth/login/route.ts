import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionToken, getSessionCookieOptions } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const sessionUser = {
      id: String(user.id),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = await createSessionToken(sessionUser);

    await logAuditEvent({
      action: "USER_LOGIN",
      entity: "User",
      entityId: String(user.id),
      userId: user.id,
      userRole: user.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
    });

    const cookieOpts = getSessionCookieOptions();
    response.cookies.set(cookieOpts.name, token, cookieOpts);

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    let errorMessage = error.message || "Internal server error";

    if (
      errorMessage.includes("Authentication failed against database server") ||
      errorMessage.includes("provided database credentials") ||
      errorMessage.includes("Access denied for user")
    ) {
      errorMessage =
        "Database Connection Error: Aiven MySQL authentication failed. Please verify that your newly rotated Aiven connection URL or password is saved in your local .env file and run 'npx prisma db push && npm run prisma:seed'.";
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
