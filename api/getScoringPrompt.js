// api/getScoringPrompt.js (完全版)
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const { sessionId, lastSeenId } = req.query; // lastSeenIdを受け取る
    if (!sessionId) {
      return res.status(400).json({ error: "セッションIDが必要です。" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // ▼▼▼ 変更箇所：クエリを全面的に変更 ▼▼▼
    let query = supabase
      .from("scoring_prompts")
      .select("*")
      .eq("session_id", sessionId);

    // もしlastSeenIdが提供されていれば、それより大きいIDのものを探す
    if (lastSeenId && lastSeenId !== "null") {
      query = query.gt("id", lastSeenId);
    }

    // IDが最も小さい（＝次の）プロンプトを1件だけ取得
    query = query.order("id", { ascending: true }).limit(1).single();

    const { data, error } = await query;
    // ▲▲▲ 変更箇所 ▲▲▲

    if (error) {
      if (error.code === "PGRST116") {
        // 見つからない場合は正常
        return res.status(200).json(null);
      }
      throw error;
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
