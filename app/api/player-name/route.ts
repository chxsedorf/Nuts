import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function sanitizePlayerName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 12)
    .toUpperCase();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      playerId?: string;
      playerName?: string;
    };

    const playerId = String(body.playerId ?? "").trim();
    const playerName = sanitizePlayerName(String(body.playerName ?? "PLAYER")) || "PLAYER";

    if (!playerId) {
      return NextResponse.json(
        { ok: false, error: "invalid_player_id" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    const { data: takenName, error: takenError } = await supabase
      .from("nuts_players")
      .select("player_id")
      .eq("player_name", playerName)
      .neq("player_id", playerId)
      .limit(1)
      .maybeSingle();

    if (takenError) {
      return NextResponse.json(
        { ok: false, error: takenError.message },
        { status: 500 }
      );
    }

    if (takenName) {
      return NextResponse.json(
        { ok: false, error: "name_taken" },
        { status: 409 }
      );
    }

    const { error: upsertError } = await supabase.from("nuts_players").upsert(
      {
        player_id: playerId,
        player_name: playerName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "player_id" }
    );

    if (upsertError) {
      if (upsertError.code === "23505") {
        return NextResponse.json(
          { ok: false, error: "name_taken" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { ok: false, error: upsertError.message },
        { status: 500 }
      );
    }

    const { error: scoreNameUpdateError } = await supabase
      .from("nuts_scores")
      .update({ player_name: playerName })
      .eq("player_id", playerId);

    if (scoreNameUpdateError) {
      return NextResponse.json(
        { ok: false, error: scoreNameUpdateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, playerName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
