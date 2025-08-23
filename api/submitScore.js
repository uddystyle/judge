// api/submitScore.js

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { bib, score, judge, discipline, event, level } = req.body;

    if (!bib || !score || !judge || !discipline || !event || !level) {
      // level の存在もチェック
      return res.status(400).json({ error: "必須データが不足しています。" });
    }

    const { data, error } = await supabase
      .from("results")
      .insert([
        {
          created_at: new Date().toISOString(),
          bib: bib,
          score: score,
          judge_name: judge,
          discipline: discipline,
          level: level,
          event_name: event,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log("データ保存成功:", data);
    res.status(200).json({
      status: "success",
      bib: data.bib,
      score: data.score,
    });
  } catch (error) {
    console.error("データ保存エラー:", error.message);
    res.status(500).json({ error: error.message });
  }
};
