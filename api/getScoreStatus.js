// api/getScoreStatus.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const { sessionId, bib, discipline, level, event } = req.query;
    if (!sessionId || !bib || !discipline || !level || !event) {
      return res
        .status(400)
        .json({ error: "必須パラメーターが不足しています。" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // 1. この選手・種目に対する全審判の得点を取得
    const { data: scores, error: scoresError } = await supabase
      .from("results")
      .select("judge_name, score")
      .eq("session_id", sessionId)
      .eq("bib", bib)
      .eq("discipline", discipline)
      .eq("level", level)
      .eq("event_name", event);

    if (scoresError) throw scoresError;

    // 2. 現在の検定の進行状況とアクティブ状態を取得
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("active_prompt_id, is_active") // is_active を追加
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;

    // 3. 結果を結合して返す
    res.status(200).json({
      scores: scores,
      activePromptId: sessionData.active_prompt_id,
      is_active: sessionData.is_active, // 応答に is_active を追加
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
