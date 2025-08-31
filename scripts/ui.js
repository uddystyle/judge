// scripts/ui.js （完全版）
import { state } from "./state.js";

export function updateScoreScreenButtons() {
  const backToBibButton = document.getElementById("btn-score-back-to-bib");
  if (!backToBibButton) return;

  if (
    state.currentSession?.is_multi_judge &&
    state.currentUser?.id !== state.currentSession?.chief_judge_id
  ) {
    backToBibButton.style.display = "none";
  } else {
    backToBibButton.style.display = "block";
  }
}

export function showScreen(screenId) {
  window.scrollTo(0, 0);
  const header = document.querySelector(".header");
  if (!header) return;

  if (["landing-screen", "login-screen", "signup-screen"].includes(screenId)) {
    header.style.display = "none";
  } else {
    header.style.display = "block";
  }
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add("active");

  const activeScreen = document.querySelector(".screen.active");
  if (activeScreen) state.previousScreen = activeScreen.id;
}

export function setHeaderText(text) {
  const headerText = document.getElementById("header-main-text");
  if (headerText) headerText.textContent = text;
}

export function setLoading(isLoading) {
  const loadingOverlay = document.getElementById("loading-overlay");
  if (loadingOverlay) loadingOverlay.classList.toggle("active", isLoading);
}

export function updateInfoDisplay() {
  const userInfo = document.getElementById("user-info");
  if (userInfo)
    userInfo.textContent =
      state.currentUser?.full_name || "ログインしていません";

  const sessionInfo = document.getElementById("session-info");
  if (sessionInfo) {
    sessionInfo.textContent =
      state.currentSession?.session_name ||
      state.currentSession?.name ||
      "未選択";
  }

  const selEl = document.getElementById("selection-info");
  if (selEl) selEl.textContent = getSelectionLabel();

  // ▼▼▼ 変更箇所 ▼▼▼
  const bibInfo = document.getElementById("bib-info");
  if (bibInfo) {
    if (state.currentBib) {
      bibInfo.textContent = `| ゼッケン: ${state.currentBib}`;
    } else {
      bibInfo.textContent = "";
    }
  }
  // ▲▲▲ 変更箇所 ▲▲▲
}

function getSelectionLabel() {
  const parts = [];
  if (state.selectedDiscipline) parts.push(state.selectedDiscipline);
  if (state.selectedLevel) parts.push(state.selectedLevel);
  if (state.selectedEvent) parts.push(state.selectedEvent);
  return parts.length ? `選択中: ${parts.join(" / ")}` : "選択中: ー";
}

export function createButton(parent, text, onClick) {
  const btn = document.createElement("button");
  btn.className = "key select-item";
  btn.textContent = text;
  btn.onclick = onClick;
  parent.appendChild(btn);
}

export function onApiError(error) {
  alert("エラー: " + error.message);
  setLoading(false);
}

export function onSubmitError(error) {
  const submitStatus = document.getElementById("submit-status");
  if (submitStatus) {
    submitStatus.innerHTML = `<div class="error">送信エラー: ${error.message}<br><button class="nav-btn" id="btn-submit-retry">再試行</button></div>`;
    document
      .getElementById("btn-submit-retry")
      ?.addEventListener("click", () =>
        import("./session.js").then((module) => module.submitEntry())
      );
  }
}

export function copyJoinCode(event, code) {
  event.stopPropagation();
  navigator.clipboard
    .writeText(code)
    .then(() => {
      const copyButton = event.target;
      copyButton.textContent = "COPIED!";
      setTimeout(() => {
        copyButton.textContent = "copy";
      }, 1500);
    })
    .catch((err) => {
      console.error("コピーに失敗しました:", err);
      alert("コピーに失敗しました。");
    });
}

export function clearLoginError() {
  const errorMessage = document.getElementById("login-error-message");
  if (errorMessage) errorMessage.innerHTML = "";
}

export function showConfirmDialog(message, onConfirm) {
  const confirmMessage = document.getElementById("confirm-message");
  if (confirmMessage) confirmMessage.textContent = message;
  state.onConfirmAction = onConfirm;
  showScreen("confirm-screen");
}

export function cancelConfirm() {
  if (state.previousScreen) showScreen(state.previousScreen);
}
