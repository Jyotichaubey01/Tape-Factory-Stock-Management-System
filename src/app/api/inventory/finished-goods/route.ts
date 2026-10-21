import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getFinishedGoodsBalances } from "@/lib/services/stock-service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stock = await getFinishedGoodsBalances();

  const ledger = await prisma.finishedGoodsLedger.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      specification: true,
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ stock, ledger });
}
