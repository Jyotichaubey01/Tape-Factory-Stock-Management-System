import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createSpecification } from "@/lib/services/specification-service";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const specs = await prisma.tapeSpecification.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Map to common frontend format
  const mapped = specs.map((s) => ({
    id: s.id,
    code: s.code,
    version: 1,
    widthMm: Number(s.widthMm),
    filmGsm: Number(s.filmGsm),
    dryCoatingGsm: Number(s.dryAdhesiveGsm),
    adhesiveSolidsPercent: Number(s.solidsPercent),
    rollLengthM: Number(s.rollLengthM),
    isUsedForProduction: false,
    createdAt: s.createdAt,
  }));

  return NextResponse.json({ specifications: mapped });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      entityId: String(spec.id),
      details: { code: spec.code, widthMm: Number(spec.widthMm), filmGsm: Number(spec.filmGsm) },
      userId: user.id,
      userRole: user.role,
    });

    return NextResponse.json({ success: true, specification: spec }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create specification" }, { status: 400 });
  }
}
