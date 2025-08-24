// supabase/functions/create-session/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORSヘッダー
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 6桁のランダムな参加コードを生成するヘルパー関数
const generateJoinCode = () => {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

Deno.serve(async (req) => {
  // OPTIONSリクエスト（CORSプリフライト）に正しく応答する
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("User not found");

    const { sessionName } = await req.json();
    if (!sessionName) throw new Error("Session name is required");

    const joinCode = generateJoinCode();

    // サービスロールキーを持つ管理者クライアントを作成
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({ name: sessionName, created_by: user.id, join_code: joinCode })
      .select()
      .single();

    if (sessionError) throw sessionError;

    await supabaseAdmin.from("session_participants").insert({
      session_id: sessionData.id,
      user_id: user.id,
    });

    return new Response(JSON.stringify(sessionData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
