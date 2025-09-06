// api/submitScore.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      bib,
      score,
      judge,
      discipline,
      event,
      level,
      sessionId,
      userToken,
    } = req.body;

    if (
      !bib ||
      score === undefined || // score can be 0, so check for undefined
      !judge ||
      !discipline ||
      !event ||
      !level ||
      !sessionId ||
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

    const { data, error } = await supabase
      .from("results")
      .upsert(
        {
          session_id: sessionId,
          bib: bib,
          score: score,
          judge_name: judge,
          discipline: discipline,
          level: level,
          event_name: event,
        },
        {
          onConflict:
            "session_id, bib, discipline, level, event_name, judge_name",
        }
      )
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      status: "success",
      bib: data.bib,
      score: data.score,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
