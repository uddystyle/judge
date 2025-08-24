// api/signup.js
const { createClient } = require("@supabase/supabase-js");

// Vercelの環境変数からキーを読み込む
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "必須項目が不足しています。" });
    }

    // Supabase Authに新しいユーザーを作成
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("ユーザーの作成に失敗しました。");

    // profilesテーブルに名前を保存
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      full_name: fullName,
    });

    if (profileError) throw profileError;

    res.status(200).json({ success: true, user: authData.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
