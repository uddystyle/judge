const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const { sessionId, lastSeenId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: "セッションIDが必要です。" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("active_prompt_id, is_active") // is_activeも取得
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;
    if (!sessionData)
      return res.status(404).json({ error: "Session not found." });

    const activePromptId = sessionData.active_prompt_id;

    // アクティブな指示がない、または最後に見た指示と同じ場合はnullを返す
    if (!activePromptId || activePromptId == lastSeenId) {
      // 指示がなくてもセッションの状態は返す
      return res
        .status(200)
        .json({ prompt: null, is_active: sessionData.is_active });
    }

    // 新しいアクティブな指示があれば、その詳細を取得
    const { data: promptData, error: promptError } = await supabase
      .from("scoring_prompts")
      .select("*")
      .eq("id", activePromptId)
      .single();

    if (promptError) throw promptError;

    // フロントエンドが期待する { prompt: ..., is_active: ... } の形式で返す
    res
      .status(200)
      .json({ prompt: promptData, is_active: sessionData.is_active });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
