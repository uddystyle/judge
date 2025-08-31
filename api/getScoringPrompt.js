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

    // scoring_promptsテーブルから、指定されたセッションIDの最新の1件を取得
    const { data, error } = await supabase
      .from("scoring_prompts")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false }) // 作成日時が最新のもの
      .limit(1)
      .single(); // 1件だけ取得

    if (error) {
      // まだプロンプトがない場合はエラーではなく、空のオブジェクトを返す
      if (error.code === "PGRST116") {
        return res.status(200).json(null);
      }
      throw error;
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
