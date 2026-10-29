import { prisma } from "./prisma";

export async function checkIdempotency(key: string, route: string, requestPayload: any) {
  if (!key) return null;

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing && existing.result) {
      const data = existing.result as any;
      return {
        status: data.status || 200,
        body: data.body || data,
      };
    }
  } catch (e) {
    console.error("Idempotency lookup error:", e);
  }

  return null;
}

export async function saveIdempotency(
  key: string,
  route: string,
  requestPayload: any,
  responseStatus: number,
  responseBody: any,
  userId: string | number
) {
  if (!key) return;

  try {
    await prisma.idempotencyKey.upsert({
      where: { key },
      update: {
        operation: route,
        result: { status: responseStatus, body: responseBody },
      },
      create: {
        key,
        operation: route,
        result: { status: responseStatus, body: responseBody },
      },
    });
  } catch (e) {
    console.error("Failed to store idempotency record:", e);
  }
}
