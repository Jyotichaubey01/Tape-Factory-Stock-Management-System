import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordMaterialDamage } from "@/lib/services/stock-service";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { materialType, quantity, notes } = body;

    if (!notes || notes.trim().length < 3) {
      return NextResponse.json({ error: "A note explaining the damage/scrap is required" }, { status: 400 });
    }

    const dbMaterial =
      materialType === "LIQUID_ADHESIVE" ? "ADHESIVE" : materialType === "CORE" ? "CORES" : "FILM";

    const record = await recordMaterialDamage({
      materialType: dbMaterial as any,
      quantity: Number(quantity),
      notes,
      userId: user.id,
    });

    await logAuditEvent({
      action: "RECORD_MATERIAL_DAMAGE",
      entity: "MaterialLedger",
      entityId: String(record.id),
      details: { material: dbMaterial, quantity, notes },
      userId: user.id,
      userRole: user.role,
    });

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to record damage" }, { status: 400 });
  }
}
