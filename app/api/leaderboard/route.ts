import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Period = "daily" | "monthly" | "all";

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, supabaseKey, {
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");
    const period: Period =
      periodParam === "monthly" || periodParam === "all" ? periodParam : "daily";

    const supabase = createSupabaseClient();
    let query = supabase
      .from("nuts_scores")
      .select("player_name, score, created_at")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(20);

    const start = getJstPeriodStart(period);
    if (start) {
      query = query.gte("created_at", start);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
