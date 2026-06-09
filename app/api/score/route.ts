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

async function resolveRegisteredPlayerName(
  supabase: ReturnType<typeof createSupabaseClient>,
  playerId: string,
  requestedName: string
) {
  const fallbackName = sanitizePlayerName(requestedName) || "PLAYER";

  const { data: existingPlayer, error: existingPlayerError } = await supabase
    .from("nuts_players")
    .select("player_name")
    .eq("player_id", playerId)
    .maybeSingle();

  if (existingPlayerError) {
    throw new Error(existingPlayerError.message);
  }

  if (existingPlayer?.player_name) {
    return String(existingPlayer.player_name);
  }

  const { data: takenName, error: takenError } = await supabase
    .from("nuts_players")
    .select("player_id")
    .eq("player_name", fallbackName)
    .neq("player_id", playerId)
    .limit(1)
    .maybeSingle();

  if (takenError) {
    throw new Error(takenError.message);
  }

  if (takenName) {
    throw new Error("name_taken");
  }

  const { error: insertPlayerError } = await supabase.from("nuts_players").insert({
    player_id: playerId,
    player_name: fallbackName,
    updated_at: new Date().toISOString(),
  });

  if (insertPlayerError) {
    if (insertPlayerError.code === "23505") {
      throw new Error("name_taken");
    }

    throw new Error(insertPlayerError.message);
  }

  return fallbackName;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      playerId?: string;
      playerName?: string;
      score?: number;
    };

    const playerId = String(body.playerId ?? "").trim();
    const score = Math.floor(Number(body.score ?? 0));

    if (!playerId || !Number.isFinite(score) || score <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid score payload." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const playerName = await resolveRegisteredPlayerName(
      supabase,
      playerId,
      String(body.playerName ?? "PLAYER")
    );

    const { data: currentBest, error: currentBestError } = await supabase
      .from("nuts_scores")
      .select("id, score, player_name")
      .eq("player_id", playerId)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentBestError) {
      return NextResponse.json(
        { ok: false, error: currentBestError.message },
        { status: 500 }
      );
    }

    if (currentBest && String(currentBest.player_name) !== playerName) {
      await supabase
        .from("nuts_scores")
        .update({ player_name: playerName })
        .eq("player_id", playerId);
    }

    if (currentBest && Number(currentBest.score) >= score) {
      return NextResponse.json({
        ok: true,
        submitted: false,
        reason: "not_high_score",
        bestScore: Number(currentBest.score),
        playerName,
      });
    }

    const { error: insertError } = await supabase.from("nuts_scores").insert({
      player_id: playerId,
      player_name: playerName,
      score,
    });

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    await supabase
      .from("nuts_scores")
      .delete()
      .eq("player_id", playerId)
      .lt("score", score);

    return NextResponse.json({ ok: true, submitted: true, bestScore: score, playerName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "name_taken" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
