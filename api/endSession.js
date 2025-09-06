// api/endSession.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { userToken, sessionId } = req.body;
    if (!userToken || !sessionId) {
      return res.status(400).json({ error: "必須データが不足しています。" });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(userToken);
    if (!user) {
      return res.status(401).json({ error: "認証されていません。" });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("chief_judge_id")
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;
    if (session.chief_judge_id !== user.id) {
      return res.status(403).json({
        error: "この操作を行う権限がありません（主任検定員ではありません）。",
      });
    }

    // sessionsテーブルのis_activeをfalseに更新
    const { error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({ is_active: false })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    res.status(200).json({ success: true, message: "検定を終了しました。" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
