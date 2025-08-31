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

    // 手順1: sessionsテーブルから現在のactive_prompt_idを取得
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("active_prompt_id")
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;

    const activePromptId = sessionData.active_prompt_id;

    // アクティブな指示がない、または最後に見た指示と同じ場合はnullを返す
    if (!activePromptId || activePromptId == lastSeenId) {
      return res.status(200).json(null);
    }

    // 新しいアクティブな指示があれば、その詳細を取得して返す
    const { data: promptData, error: promptError } = await supabase
      .from("scoring_prompts")
      .select("*")
      .eq("id", activePromptId)
      .single();

    if (promptError) throw promptError;

    res.status(200).json(promptData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
