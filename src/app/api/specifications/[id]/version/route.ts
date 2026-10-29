import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSpecificationVersion } from "@/lib/services/specification-service";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin can create specification versions" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const newSpec = await createSpecificationVersion(params.id, body, user.id);

    await logAuditEvent({
      action: "VERSION_SPECIFICATION",
      entity: "TapeSpecification",
      entityId: String(newSpec.id),
      details: { originalId: params.id, newCode: newSpec.code },
      userId: user.id,
      userRole: user.role,
    });

    return NextResponse.json({ success: true, specification: newSpec }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to version specification" }, { status: 400 });
  }
}
