import { prisma } from "./prisma";

export async function checkIdempotency(key: string, route: string, requestPayload: any) {
  if (!key) return null;

  const existing = await prisma.idempotencyKey.findUnique({
    where: { key },
  });

  if (existing) {
    if (new Date() > existing.expiresAt) {
      await prisma.idempotencyKey.delete({ where: { key } });
      return null;
    }
    return {
      status: existing.responseStatus,
      body: JSON.parse(existing.responseBody),
    };
  }

  return null;
}

export async function saveIdempotency(
  key: string,
  route: string,
  requestPayload: any,
  responseStatus: number,
  responseBody: any,
  userId: string
) {
  if (!key) return;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  try {
    await prisma.idempotencyKey.upsert({
      where: { key },
      update: {
        responseStatus,
        responseBody: JSON.stringify(responseBody),
        expiresAt,
      },
      create: {
        key,
        route,
        requestHash: typeof requestPayload === "string" ? requestPayload : JSON.stringify(requestPayload),
        responseStatus,
        responseBody: JSON.stringify(responseBody),
        userId,
        expiresAt,
      },
    });
  } catch (e) {
    console.error("Failed to store idempotency record:", e);
  }
}
