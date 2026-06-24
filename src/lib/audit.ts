import { prisma } from "@/lib/db";

export async function logAudit(params: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        detail: params.detail,
      },
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}
