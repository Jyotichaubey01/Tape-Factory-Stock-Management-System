import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { performAdminStockCorrection } from "@/lib/services/correction-service";
import { adminCorrectionSchema } from "@/lib/validations";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin only
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN: Admin permissions required." }, { status: 403 });
  }

  const corrections = await prisma.correctionRecord.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      admin: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ corrections });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Strict server-side role check: Staff attempting admin corrections get 403
  if (user.role !== "ADMIN") {
    await logAuditEvent({
      action: "UNAUTHORIZED_CORRECTION_ATTEMPT",
      entity: "CorrectionRecord",
      details: { attemptedBy: user.email, role: user.role },
      userId: user.id,
      userRole: user.role,
    });
    return NextResponse.json(
      { error: "FORBIDDEN: Only System Administrators can perform corrections." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = adminCorrectionSchema.parse(body);

    const record = await performAdminStockCorrection({
      targetType: parsed.targetType as any,
      materialType: parsed.materialType,
      specificationId: parsed.specificationId,
      adjustmentQuantity: parsed.adjustmentQuantity || 0,
      reason: parsed.reason,
      adminId: user.id,
      adminRole: user.role,
    });

    await logAuditEvent({
      action: "ADMIN_STOCK_CORRECTION",
      entity: "CorrectionRecord",
      entityId: record.id,
      details: {
        targetType: parsed.targetType,
        adjustmentQuantity: parsed.adjustmentQuantity,
        reason: parsed.reason,
      },
      userId: user.id,
      userRole: user.role,
    });

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return NextResponse.json({ error: error.message || "Failed to process correction" }, { status: statusCode });
  }
}
