import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getFinishedGoodsBalances } from "@/lib/services/stock-service";
import Decimal from "decimal.js";

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

  const mappedLedger = ledger.map((l) => {
    const rollLen = new Decimal(l.specification.rollLengthM.toString());
    const areaM2 = new Decimal(l.specification.widthMm.toString())
      .div(1000)
      .mul(rollLen);
    const filmKg = areaM2.mul(l.specification.filmGsm.toString()).div(1000);
    const dryAdhKg = areaM2.mul(l.specification.dryAdhesiveGsm.toString()).div(1000);
    const netKgPerRoll = filmKg.plus(dryAdhKg);
    const netTapeKg = netKgPerRoll.mul(l.deltaRolls).toNumber();
    const metres = rollLen.mul(l.deltaRolls).toNumber();

    return {
      id: String(l.id),
      specification: {
        code: l.specification.code,
      },
      transactionType: l.type === "PRODUCTION" ? "PRODUCTION_RECEIPT" : l.type,
      rollCount: l.deltaRolls,
      netTapeKg,
      metres,
      referenceId: l.reference,
      notes: l.reason || "",
      createdAt: l.createdAt,
      user: l.user,
    };
  });

  return NextResponse.json({ stock, ledger: mappedLedger });
}
