// api/getSessionDetails.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: "セッションIDが必要です。" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // 手順1: 検定の全設定を取得
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select(
        "name, is_multi_judge, required_judges, chief_judge_id, created_by"
      )
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;

    // 手順2: 参加しているユーザーのIDと名前を取得
    const { data: participantsData, error: participantsError } = await supabase
      .from("session_participants")
      .select(
        `
        user_id,
        profiles (
          full_name
        )
      `
      )
      .eq("session_id", sessionId);

    if (participantsError) throw participantsError;

    // データを整形
    const participants = participantsData.map((p) => ({
      user_id: p.user_id,
      full_name: p.profiles.full_name,
    }));

    // 最終的なデータをフロントエンドに返す
    res.status(200).json({
      id: sessionId, // レスポンスにセッションIDを追加
      session_name: sessionData.name,
      is_multi_judge: sessionData.is_multi_judge,
      required_judges: sessionData.required_judges,
      chief_judge_id: sessionData.chief_judge_id,
      created_by: sessionData.created_by,
      participants: participants,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
