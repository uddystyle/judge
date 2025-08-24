// api/joinSession.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { joinCode, userToken } = req.body;
    if (!joinCode || !userToken) {
      return res.status(400).json({ error: "参加コードを入力してください。" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: { headers: { Authorization: `Bearer ${userToken}` } },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("認証されていません。");

    // 参加コードに一致するセッションを検索
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("join_code", joinCode.toUpperCase()) // 大文字に統一して検索
      .single();

    if (sessionError || !sessionData) {
      return res.status(404).json({ error: "無効な参加コードです。" });
    }

    // session_participantsテーブルに参加者として追加
    const { error: joinError } = await supabase
      .from("session_participants")
      .insert({
        session_id: sessionData.id,
        user_id: user.id,
      });

    // 既にメンバーである等の重複エラーは無視して成功とみなす
    if (joinError && joinError.code !== "23505") {
      // '23505'はunique_violationエラーコード
      throw joinError;
    }

    res.status(200).json({ success: true, session: sessionData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
