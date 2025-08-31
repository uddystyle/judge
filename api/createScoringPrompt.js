// api/createScoringPrompt.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { userToken, promptData } = req.body;
    if (!userToken || !promptData) {
      return res.status(400).json({ error: "必須データが不足しています。" });
    }

    // 管理者権限でSupabaseクライアントを初期化
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // 1. ユーザーを認証
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(userToken);
    if (!user) {
      return res.status(401).json({ error: "認証されていません。" });
    }

    // 2. 検証：ユーザーが本当にそのセッションの主任検定員か確認
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("chief_judge_id")
      .eq("id", promptData.session_id)
      .single();

    if (sessionError) throw sessionError;

    if (session.chief_judge_id !== user.id) {
      return res
        .status(403)
        .json({
          error: "この操作を行う権限がありません（主任検定員ではありません）。",
        });
    }

    // 3. 検証が通れば、管理者としてscoring_promptsに書き込む
    const { error: insertError } = await supabaseAdmin
      .from("scoring_prompts")
      .insert(promptData);

    if (insertError) throw insertError;

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
