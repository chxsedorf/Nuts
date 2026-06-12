import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Period = "daily" | "monthly" | "all";
type SupabaseScoreRow = {
  player_id: string;
  player_name: string;
  score: number;
  created_at: string;
};

type RankedRow = SupabaseScoreRow & { rank: number };

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function getJstPeriodStart(period: Period): string | null {
  if (period === "all") return null;

  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const year = jstNow.getUTCFullYear();
  const month = jstNow.getUTCMonth();
  const date = jstNow.getUTCDate();

  const jstStart =
    period === "daily"
      ? Date.UTC(year, month, date, 0, 0, 0)
      : Date.UTC(year, month, 1, 0, 0, 0);

  const utcStart = new Date(jstStart - 9 * 60 * 60 * 1000);
  return utcStart.toISOString();
}

function pickBestRowsByPlayer(rows: SupabaseScoreRow[]) {
  const bestByPlayer = new Map<string, SupabaseScoreRow>();

  for (const row of rows) {
    const existing = bestByPlayer.get(row.player_id);
    if (
      !existing ||
      row.score > existing.score ||
      (row.score === existing.score &&
        new Date(row.created_at).getTime() < new Date(existing.created_at).getTime())
    ) {
      bestByPlayer.set(row.player_id, row);
    }
  }

  return Array.from(bestByPlayer.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period") ?? searchParams.get("range");
    const period: Period =
      periodParam === "monthly" || periodParam === "all" ? periodParam : "daily";
    const playerId = String(searchParams.get("playerId") ?? "").trim();

    const supabase = createSupabaseClient();
    let query = supabase
      .from("nuts_scores")
      .select("player_id, player_name, score, created_at")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(5000);

    const start = getJstPeriodStart(period);
    if (start) {
      query = query.gte("created_at", start);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rankedRows: RankedRow[] = pickBestRowsByPlayer(
      ((data ?? []) as SupabaseScoreRow[])
    ).map((row, index) => ({ ...row, rank: index + 1 }));

    const myRow = playerId
      ? rankedRows.find((row) => row.player_id === playerId) ?? null
      : null;

    const rows = rankedRows.slice(0, 20).map(({ rank, player_name, score, created_at }) => ({
      rank,
      player_name,
      score,
      created_at,
    }));

    return NextResponse.json({
      ok: true,
      rows,
      totalPlayers: rankedRows.length,
      myRank: myRow?.rank ?? null,
      myScore: myRow?.score ?? null,
      myPlayerName: myRow?.player_name ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
