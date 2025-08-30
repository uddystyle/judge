// scripts/main.js
import { supabase } from "./supabase.js";
import {
  setUserState,
  handleLogin,
  handleLogout,
  handleSignup,
  showAccountScreen,
  handleUpdateName,
  handleUpdatePassword,
  showDeleteConfirm,
  handleDeleteAccount,
} from "./auth.js";
import {
  loadDashboard,
  handleCreateSession,
  handleJoinSession,
  inputNumber,
  clearInput,
  confirmScore,
  inputBibNumber,
  clearBibInput,
  confirmBib,
  submitEntry,
  nextSkier,
  changeEvent,
  executeConfirm,
  goBackToDashboard,
  goBackToDisciplineSelect,
  goBackToLevelSelect,
  goBackToBibScreen,
  editEntry,
  handleExportOrShare,
  handleUpdateSessionName,
  showDeleteSessionConfirm,
  handleDeleteSession,
} from "./session.js";
import {
  showScreen,
  cancelConfirm,
  clearLoginError,
  setHeaderText,
} from "./ui.js";

function initializeEventListeners() {
  // Landing Screen
  document
    .getElementById("btn-landing-signup")
    ?.addEventListener("click", () => showScreen("signup-screen"));
  document
    .getElementById("btn-landing-login")
    ?.addEventListener("click", () => showScreen("login-screen"));

  // Auth Screens
  document.getElementById("btn-login")?.addEventListener("click", handleLogin);
  document
    .getElementById("btn-signup")
    ?.addEventListener("click", handleSignup);
  document.getElementById("btn-goto-signup")?.addEventListener("click", () => {
    clearLoginError();
    showScreen("signup-screen");
  });
  document
    .getElementById("btn-back-to-login")
    ?.addEventListener("click", () => {
      clearLoginError();
      showScreen("login-screen");
    });
  document
    .getElementById("login-email")
    ?.addEventListener("input", clearLoginError);
  document
    .getElementById("login-password")
    ?.addEventListener("input", clearLoginError);

  // Dashboard Screen
  document
    .getElementById("btn-logout")
    ?.addEventListener("click", handleLogout);
  document
    .getElementById("btn-goto-create-session")
    ?.addEventListener("click", () => showScreen("create-session-screen"));
  document
    .getElementById("btn-goto-join-session")
    ?.addEventListener("click", () => showScreen("join-session-screen"));
  document
    .getElementById("btn-goto-account")
    ?.addEventListener("click", showAccountScreen);

  // Create/Join Session Screens
  document
    .getElementById("btn-create-session")
    ?.addEventListener("click", handleCreateSession);
  document
    .getElementById("btn-create-back-to-dash")
    ?.addEventListener("click", goBackToDashboard);
  document
    .getElementById("btn-join-session")
    ?.addEventListener("click", handleJoinSession);
  document
    .getElementById("btn-join-back-to-dash")
    ?.addEventListener("click", goBackToDashboard);

  // Discipline/Level/Event Screens
  document
    .getElementById("btn-discipline-back-to-dash")
    ?.addEventListener("click", goBackToDashboard);
  document
    .getElementById("btn-level-back-to-discipline")
    ?.addEventListener("click", goBackToDisciplineSelect);
  document
    .getElementById("btn-event-back-to-level")
    ?.addEventListener("click", goBackToLevelSelect);

  // Scoring Screens
  document.getElementById("score-keypad")?.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.matches(".numeric-key[data-value]")) {
      inputNumber(target.dataset.value);
    }
  });
  document
    .getElementById("btn-score-clear")
    ?.addEventListener("click", clearInput);
  document
    .getElementById("btn-score-confirm")
    ?.addEventListener("click", confirmScore);
  document
    .getElementById("btn-score-back-to-bib")
    ?.addEventListener("click", goBackToBibScreen);

  document.getElementById("bib-keypad")?.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.matches(".numeric-key[data-value]")) {
      inputBibNumber(target.dataset.value);
    }
  });
  document
    .getElementById("btn-bib-clear")
    ?.addEventListener("click", clearBibInput);
  document
    .getElementById("btn-bib-confirm")
    ?.addEventListener("click", confirmBib);
  document
    .getElementById("btn-bib-back-to-event")
    ?.addEventListener("click", changeEvent);

  // Submit Screen
  document
    .getElementById("btn-edit-entry")
    ?.addEventListener("click", editEntry);
  document
    .getElementById("btn-submit-entry")
    ?.addEventListener("click", submitEntry);

  // Complete Screen
  document
    .getElementById("btn-next-skier")
    ?.addEventListener("click", nextSkier);
  document
    .getElementById("share-button-complete")
    ?.addEventListener("click", handleExportOrShare);

  // Confirm Dialog
  document
    .getElementById("btn-confirm-yes")
    ?.addEventListener("click", executeConfirm);
  document
    .getElementById("btn-confirm-no")
    ?.addEventListener("click", cancelConfirm);

  // Account Screen
  document
    .getElementById("btn-update-name")
    ?.addEventListener("click", handleUpdateName);
  document
    .getElementById("btn-update-password")
    ?.addEventListener("click", handleUpdatePassword);
  document
    .getElementById("btn-goto-delete-account")
    ?.addEventListener("click", showDeleteConfirm);
  document
    .getElementById("btn-account-back-to-dash")
    ?.addEventListener("click", goBackToDashboard);

  // Delete Account Confirm Screen
  document
    .getElementById("btn-delete-account")
    ?.addEventListener("click", handleDeleteAccount);
  document
    .getElementById("btn-delete-account-cancel")
    ?.addEventListener("click", () => showScreen("account-screen"));

  // Session Details Screen
  document
    .getElementById("btn-update-session-name")
    ?.addEventListener("click", handleUpdateSessionName);
  document
    .getElementById("btn-goto-delete-session")
    ?.addEventListener("click", showDeleteSessionConfirm);
  document
    .getElementById("btn-details-back-to-dash")
    ?.addEventListener("click", goBackToDashboard);

  // Delete Session Confirm Screen
  document
    .getElementById("btn-delete-session")
    ?.addEventListener("click", handleDeleteSession);
  document
    .getElementById("btn-delete-session-cancel")
    ?.addEventListener("click", () => showScreen("session-details-screen"));
}

// === アプリケーションの初期化 ===
document.addEventListener("DOMContentLoaded", async () => {
  initializeEventListeners();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    await setUserState(session);
  } else {
    setHeaderText("ようこそ");
    showScreen("landing-screen");
  }
});
