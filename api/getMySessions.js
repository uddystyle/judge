// api/getMySessions.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const { userToken } = req.query;
    if (!userToken) {
      return res.status(401).json({ error: "認証トークンが必要です。" });
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
    if (!user) throw new Error("認証されていません。");

    // ユーザーが参加しているセッションの情報を取得
    const { data, error } = await supabase
      .from("session_participants")
      .select(
        `
        sessions (
          id,
          name,
          session_date,
          join_code
        )
      `
      )
      .eq("user_id", user.id);

    if (error) throw error;

    // データを整形して返す
    const mySessions = data.map((item) => item.sessions);
    res.status(200).json(mySessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
