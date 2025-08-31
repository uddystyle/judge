// api/updateSessionSettings.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  // 1. POSTメソッド以外は拒否
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { sessionId, userToken, settings } = req.body;

    // 2. 必須データが揃っているか検証
    if (!sessionId || !userToken || !settings) {
      return res.status(400).json({ error: "必須データが不足しています。" });
    }

    // 3. Supabaseの管理者クライアントを初期化
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 4. ユーザーを認証
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(userToken);
    if (!user) {
      return res.status(401).json({ error: "認証されていません。" });
    }

    // 5. ユーザーに権限があるか検証（検定の作成者か？）
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("created_by")
      .eq("id", sessionId)
      .single();

    if (sessionError) throw sessionError;

    if (session.created_by !== user.id) {
      return res
        .status(403)
        .json({ error: "この検定の設定を変更する権限がありません。" });
    }

    // 6. データベースを更新
    const { error: updateError } = await supabaseAdmin
      .from("sessions")
      .update(settings) // フロントエンドから送られてきたsettingsオブジェクトをそのまま適用
      .eq("id", sessionId);

    if (updateError) throw updateError;

    // 7. 成功レスポンスを返す
    res
      .status(200)
      .json({ success: true, message: "検定の設定を更新しました。" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
