import { prisma } from "./prisma";

export async function logAuditEvent(params: {
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, any>;
  userId: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        detailsJson: params.details ? JSON.stringify(params.details) : null,
        userId: params.userId,
        userRole: params.userRole,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
