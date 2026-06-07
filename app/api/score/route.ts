import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing Supabase environment variables",
          hasUrl: Boolean(supabaseUrl),
          hasServiceRoleKey: Boolean(serviceRoleKey),
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const playerId = String(body.playerId ?? "").trim();
    const playerName = String(body.playerName ?? "PLAYER").trim();
    const score = Number(body.score ?? 0);

    if (!playerId || !Number.isFinite(score) || score < 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request body",
        },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from("nuts_scores").insert({
      player_id: playerId,
      player_name: playerName || "PLAYER",
      score: Math.floor(score),
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}