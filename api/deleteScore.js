// api/deleteScore.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { sessionId, bib, judge, discipline, event, level, userToken } =
      req.body;

    if (
      !sessionId ||
      !bib ||
      !judge ||
      !discipline ||
      !event ||
      !level ||
      !userToken
    ) {
      return res.status(400).json({ error: "必須データが不足しています。" });
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
    if (!user) {
      return res.status(401).json({ error: "認証されていません。" });
    }

    const { error } = await supabase.from("results").delete().match({
      session_id: sessionId,
      bib: bib,
      judge_name: judge,
      discipline: discipline,
      level: level,
      event_name: event,
    });

    if (error) throw error;

    res
      .status(200)
      .json({ success: true, message: "スコアが削除されました。" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
