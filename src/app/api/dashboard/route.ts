import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getMaterialBalances, getFinishedGoodsBalances } from "@/lib/services/stock-service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [rawMaterials, finishedGoodsList, openOrdersCount, recentBatches, recentOrders, recentAudits] =
    await Promise.all([
      getMaterialBalances(),
      getFinishedGoodsBalances(),
      prisma.salesOrder.count({
        where: { status: { in: ["CONFIRMED", "PARTIALLY_DISPATCHED"] } },
      }),
      prisma.productionBatch.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { specification: true },
      }),
      prisma.salesOrder.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { customer: true, specification: true },
      }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
      }),
    ]);

  let totalAvailableRolls = 0;
  let totalNetTapeKg = 0;
  let totalMetres = 0;

  for (const fg of finishedGoodsList) {
    totalAvailableRolls += fg.availableRolls;
    totalNetTapeKg += fg.netTapeKg;
    totalMetres += fg.metres;
  }

  return NextResponse.json({
    metrics: {
      rawMaterials,
      finishedGoods: {
        totalAvailableRolls,
        totalNetTapeKg,
        totalMetres,
        details: finishedGoodsList,
      },
      openOrdersCount,
    },
    recentBatches,
    recentOrders,
    recentAudits,
  });
}
