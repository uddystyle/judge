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
      .eq("id", promptData.session_id)
      .single();

    if (sessionError) throw sessionError;
    if (session.chief_judge_id !== user.id) {
      return res.status(403).json({
        error: "この操作を行う権限がありません（主任検定員ではありません）。",
      });
    }

    // 手順1: scoring_promptsに新しい指示を書き込む
    const { data: newPrompt, error: insertError } = await supabaseAdmin
      .from("scoring_prompts")
      .insert(promptData)
      .select()
      .single();

    if (insertError) throw insertError;

    // 手順2: sessionsテーブルのactive_prompt_idを、今作成した指示のIDに更新する
    const { error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({ active_prompt_id: newPrompt.id })
      .eq("id", promptData.session_id);

    if (updateError) throw updateError;

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
