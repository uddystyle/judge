// api/createSession.js
const { createClient } = require("@supabase/supabase-js");

// 6桁のランダムな参加コードを生成するヘルパー関数
const generateJoinCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { sessionName, userToken } = req.body;
    if (!sessionName || !userToken) {
      return res.status(400).json({ error: "必須データが不足しています。" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        global: { headers: { Authorization: `Bearer ${userToken}` } },
      }
    );

    // ユーザー情報を取得
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("認証されていません。");

    const joinCode = generateJoinCode();

    // sessionsテーブルに新しいセッションを作成
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        name: sessionName,
        created_by: user.id,
        join_code: joinCode,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // 作成者を自動的に参加者として追加
    await supabase.from("session_participants").insert({
      session_id: sessionData.id,
      user_id: user.id,
    });

    res.status(200).json(sessionData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
