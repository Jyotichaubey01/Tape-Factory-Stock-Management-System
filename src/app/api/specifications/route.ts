import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tapeSpecificationSchema } from "@/lib/validations";
import { createSpecification } from "@/lib/services/specification-service";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const specs = await prisma.tapeSpecification.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ specifications: specs });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin only for creating new base specifications
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin can create tape specifications" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const spec = await createSpecification({
      ...body,
      createdById: user.id,
    });

    await logAuditEvent({
      action: "CREATE_SPECIFICATION",
      entity: "TapeSpecification",
      entityId: spec.id,
      details: { code: spec.code, widthMm: spec.widthMm, filmGsm: spec.filmGsm },
      userId: user.id,
      userRole: user.role,
    });

    return NextResponse.json({ success: true, specification: spec }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create specification" }, { status: 400 });
  }
}
