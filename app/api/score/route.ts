import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      playerId?: string;
      playerName?: string;
      score?: number;
    };

    const playerId = String(body.playerId ?? "").trim();
    const playerName = String(body.playerName ?? "PLAYER").trim().slice(0, 24);
    const score = Number(body.score ?? 0);

    if (!playerId || !Number.isFinite(score) || score <= 0) {
      return NextResponse.json(
        { error: "Invalid score payload." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const { error } = await supabase.from("nuts_scores").insert({
      player_id: playerId,
      player_name: playerName || "PLAYER",
      score: Math.floor(score),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
