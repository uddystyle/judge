// api/deleteSession.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { sessionId, userToken } = req.body;
    if (!sessionId || !userToken) {
      return res.status(400).json({ error: "必須データが不足しています。" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(userToken);
    if (!user) return res.status(401).json({ error: "認証されていません。" });

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("created_by")
      .eq("id", sessionId)
      .single();
    if (sessionError) throw sessionError;

    // 検定の作成者のみが削除できる
    if (session.created_by !== user.id) {
      return res
        .status(403)
        .json({ error: "この検定を削除する権限がありません。" });
    }

    // 関連データを順番に削除
    await supabaseAdmin.from("results").delete().eq("session_id", sessionId);
    await supabaseAdmin
      .from("session_participants")
      .delete()
      .eq("session_id", sessionId);
    await supabaseAdmin.from("sessions").delete().eq("id", sessionId);

    res.status(200).json({ success: true, message: "検定を削除しました。" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
