import { prisma } from "./prisma";

export async function logAuditEvent(params: {
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, any>;
  userId: string | number;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  reference?: string;
}) {
  try {
    const numericUserId =
      typeof params.userId === "number" ? params.userId : parseInt(params.userId, 10) || 1;

    await prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entity,
        entityId: params.entityId ? String(params.entityId) : "N/A",
        reference: params.reference || (params.entityId ? String(params.entityId) : "SYSTEM"),
        reason: params.reason || null,
        details: params.details || undefined,
        userId: numericUserId,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
