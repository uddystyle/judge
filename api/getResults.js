// api/getResults.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const { sessionId } = req.query; // ★セッションIDを受け取る
    if (!sessionId) {
      return res.status(400).json({ error: "セッションIDが必要です。" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { data, error } = await supabase
      .from("results")
      .select(
        "created_at, bib, score, discipline, level, event_name, judge_name"
      )
      .eq("session_id", sessionId) // ★セッションIDで絞り込み
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.status(200).json({
      results: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
