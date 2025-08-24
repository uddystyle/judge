// api/deleteUser.js
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { userToken } = req.body;
    if (!userToken) {
      return res.status(401).json({ error: "認証トークンが必要です。" });
    }

    // ★★★【重要】★★★
    // Vercelの環境変数に必ず「SUPABASE_SERVICE_ROLE_KEY」を設定してください。
    // これはSupabaseプロジェクト設定の「API」ページで確認できます。
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // ユーザー情報を取得
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(userToken);
    if (!user) {
      return res.status(404).json({ error: "ユーザーが見つかりません。" });
    }

    // Supabaseの管理者権限でユーザーを削除
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );
    if (deleteError) {
      // もしprofilesテーブルとの連携でエラーが出た場合でも、Authからユーザーを強制的に削除する
      if (deleteError.code === "23503") {
        // foreign key violation
        const { error: forceDeleteError } =
          await supabaseAdmin.auth.admin.deleteUser(user.id, true);
        if (forceDeleteError) throw forceDeleteError;
      } else {
        throw deleteError;
      }
    }

    res
      .status(200)
      .json({ success: true, message: "アカウントが正常に削除されました。" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
