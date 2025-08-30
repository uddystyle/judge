// scripts/auth.js
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import {
  showScreen,
  setLoading,
  setHeaderText,
  updateInfoDisplay,
  clearLoginError,
} from "./ui.js";
import { loadDashboard } from "./session.js";

export async function setUserState(session) {
  state.currentUser = session.user;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", state.currentUser.id)
    .single();

  if (state.currentUser) {
    state.currentUser.full_name = profile?.full_name;
  }
  updateInfoDisplay();
  await loadDashboard();
}

export async function handleLogin() {
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const errorMessageDiv = document.getElementById("login-error-message");

  const email = emailInput?.value || "";
  const password = passwordInput?.value || "";

  if (errorMessageDiv) errorMessageDiv.innerHTML = "";
  setLoading(true);

  try {
    if (!email || !password) {
      throw new Error("メールアドレスとパスワードを入力してください。");
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (error.message === "Invalid login credentials") {
        throw new Error("メールアドレスまたはパスワードが正しくありません。");
      }
      throw error;
    }
    if (data.session) {
      await setUserState(data.session);
    } else {
      throw new Error("セッションの取得に失敗しました。");
    }
  } catch (error) {
    if (errorMessageDiv) {
      errorMessageDiv.innerHTML = `<div class="error">${error.message}</div>`;
    }
  } finally {
    setLoading(false);
  }
}

export async function handleLogout() {
  setLoading(true);
  await supabase.auth.signOut();
  state.currentUser = null;
  state.currentSession = null;
  updateInfoDisplay();
  setHeaderText("ようこそ");
  showScreen("landing-screen");
  setLoading(false);
}

export async function handleSignup() {
  const fullName = document.getElementById("signup-name").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  setLoading(true);
  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    alert(
      "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。"
    );
    showScreen("login-screen");
  } catch (error) {
    alert("登録エラー: " + error.message);
  } finally {
    setLoading(false);
  }
}

export async function showAccountScreen() {
  try {
    setLoading(true);
    if (!state.currentUser) throw new Error("ユーザーがログインしていません。");

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", state.currentUser.id)
      .single();

    if (error) throw error;

    document.getElementById("account-name").value = profile?.full_name || "";
    document.getElementById("account-password").value = "";
    document.getElementById("account-password-confirm").value = "";

    setHeaderText("アカウント設定");
    showScreen("account-screen");
  } catch (error) {
    alert("ユーザー情報の取得に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

export async function handleUpdateName() {
  const newName = document.getElementById("account-name").value;
  if (!newName.trim()) return alert("氏名を入力してください。");
  if (!state.currentUser) return;

  setLoading(true);
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: newName })
      .eq("id", state.currentUser.id);
    if (error) throw error;
    state.currentUser.full_name = newName;
    updateInfoDisplay();
    alert("名前を更新しました。");
  } catch (error) {
    alert("名前の更新に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

export async function handleUpdatePassword() {
  const newPassword = document.getElementById("account-password").value;
  const confirmPassword = document.getElementById(
    "account-password-confirm"
  ).value;

  if (newPassword.length < 6)
    return alert("パスワードは6文字以上で入力してください。");
  if (newPassword !== confirmPassword)
    return alert("パスワードが一致しません。");

  setLoading(true);
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    alert("パスワードを更新しました。");
    document.getElementById("account-password").value = "";
    document.getElementById("account-password-confirm").value = "";
  } catch (error) {
    alert("パスワードの更新に失敗しました: " + error.message);
  } finally {
    setLoading(false);
  }
}

export function showDeleteConfirm() {
  showScreen("delete-confirm-screen");
}

export async function handleDeleteAccount() {
  setLoading(true);
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) throw new Error("ログインしていません。");

    const response = await fetch("/api/deleteUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: session.access_token }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "アカウントの削除に失敗しました。");

    alert("アカウントが正常に削除されました。");
    await handleLogout();
  } catch (error) {
    alert("エラー: " + error.message);
  } finally {
    setLoading(false);
  }
}
