// === グローバル変数 ===
let currentScore = "",
  currentBib = "",
  confirmedScore = 0;
let currentJudge = "",
  selectedDiscipline = "",
  selectedLevel = "",
  selectedEvent = "";
let allEvents = {};
let onConfirmAction = null;
let previousScreen = "";
let sessionId = "";

// === 初期化とデータ取得 ===
document.addEventListener("DOMContentLoaded", () => {
  currentJudge = sessionStorage.getItem("currentJudge") || "";
  sessionId = sessionStorage.getItem("sessionId");
  if (!sessionId) {
    sessionId =
      "session-" +
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem("sessionId", sessionId);
  }

  if (navigator.share) {
    // 共有が使える場合：エクスポートボタンを隠し、共有ボタンを表示
    document.getElementById("export-button-judge").style.display = "none";
    document.getElementById("export-button-complete").style.display = "none";
    document.getElementById("share-button-judge").style.display = "block";
    document.getElementById("share-button-complete").style.display = "block";
  } else {
    // 共有が使えない場合（PCなど）：共有ボタンを隠し、エクスポートボタンを表示
    document.getElementById("share-button-judge").style.display = "none";
    document.getElementById("share-button-complete").style.display = "none";
    document.getElementById("export-button-judge").style.display = "block";
    document.getElementById("export-button-complete").style.display = "block";
  }

  initializeApp();
});

window.addEventListener("beforeunload", () => {
  if (currentJudge) {
    const data = { judgeName: currentJudge, sessionId: sessionId };
    navigator.sendBeacon("/api/releaseJudge", JSON.stringify(data));
  }
});

function initializeApp() {
  setLoading(true);
  setHeaderText("データを読み込み中...");
  fetch(
    `/api/getInitialData?sessionId=${sessionId}&currentUserJudge=${encodeURIComponent(
      currentJudge
    )}`
  )
    .then((response) => response.json())
    .then((data) => {
      if (data.error) throw new Error(data.error);
      onInitialDataLoaded(data);
    })
    .catch(onApiError);
}

function onInitialDataLoaded(data) {
  allEvents = data.events || {};
  setupJudgeScreen(data.availableJudges || []);
  setLoading(false);
  if (!currentJudge) {
    resetApp();
  } else {
    updateInfoDisplay();
    setupDisciplineScreen();
    setHeaderText("種別を選択してください");
    showScreen("discipline-screen");
  }
}

// === ナビゲーションとリセット ===
function hardReset() {
  setLoading(true);
  const judgeToRelease = currentJudge;

  if (!judgeToRelease) {
    location.reload();
    return;
  }

  fetch("/api/releaseJudge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ judgeName: judgeToRelease, sessionId: sessionId }),
  })
    .then((response) => {
      if (!response.ok) {
        console.error("検定員の解放に失敗しましたが、リロードを試みます。");
      }
      sessionStorage.removeItem("currentJudge");
      location.reload();
    })
    .catch((error) => {
      console.error("解放処理中にエラー:", error);
      sessionStorage.removeItem("currentJudge");
      location.reload();
    });
}

function clearAllData() {
  showConfirmDialog(
    "全ての検定員の「使用中」状態をリセットし、アプリを初期化します。よろしいですか？",
    () => {
      setLoading(true);
      fetch("/api/clearCache") // キャッシュクリアAPIを呼び出す
        .then((response) => {
          if (!response.ok)
            throw new Error("キャッシュのクリアに失敗しました。");
          // 成功したらハードリセット（リロード）
          hardReset();
        })
        .catch(onApiError);
    }
  );
}

function refreshJudgesList() {
  hardReset();
}

function changeJudge() {
  showConfirmDialog("現在の採点を中断し、検定員選択に戻りますか？", hardReset);
}

function nextSkier() {
  currentScore = "";
  currentBib = "";
  confirmedScore = 0;
  clearInput();
  clearBibInput();
  document.getElementById("submit-status").innerHTML = "";
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}

function resetApp() {
  currentJudge = "";
  sessionStorage.removeItem("currentJudge");
  selectedDiscipline = "";
  selectedLevel = "";
  selectedEvent = "";
  updateInfoDisplay();
  setHeaderText("検定員を選択してください");
  showScreen("judge-screen");
}

// === 画面表示ロジック ===
function setupJudgeScreen(availableJudges) {
  const keypad = document.getElementById("judge-keypad");
  keypad.innerHTML = "";
  if (availableJudges.length > 0) {
    availableJudges.forEach((name) =>
      createButton(keypad, name, () => selectJudge(name))
    );
    setInstruction("judge-instruction", "ご自身の名前を選択してください");
  } else {
    setInstruction("judge-instruction", "現在、利用可能な検定員がいません。");
  }
}
function setupDisciplineScreen() {
  const keypad = document.getElementById("discipline-keypad");
  keypad.innerHTML = "";
  const disciplines = Object.keys(allEvents);
  disciplines.forEach((d) =>
    createButton(keypad, d, () => selectDiscipline(d))
  );
}
function setupLevelScreen(discipline) {
  const keypad = document.getElementById("level-keypad");
  keypad.innerHTML = "";
  const levels = Object.keys(allEvents[discipline] || {}).sort(
    (a, b) =>
      parseInt(
        a.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
        )
      ) -
      parseInt(
        b.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0)
        )
      )
  );
  levels.forEach((l) => createButton(keypad, l, () => selectLevel(l)));
}
function setupEventScreen(discipline, level) {
  const keypad = document.getElementById("event-keypad");
  keypad.innerHTML = "";
  const events = allEvents[discipline]?.[level] || [];
  events.forEach((e) => createButton(keypad, e, () => selectEvent(e)));
}

// === 選択処理と画面遷移 ===
function selectJudge(judgeName) {
  setLoading(true);
  fetch("/api/selectJudge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ judgeName: judgeName, sessionId: sessionId }),
  })
    .then((response) => response.json())
    .then((result) => {
      if (result.error) throw new Error(result.error);
      if (result.status === "success") {
        currentJudge = result.judgeName;
        sessionStorage.setItem("currentJudge", currentJudge);
        updateInfoDisplay();
        setupDisciplineScreen();
        setHeaderText("種別を選択してください");
        showScreen("discipline-screen");
      } else {
        alert(result.message);
        initializeApp();
      }
    })
    .catch(onApiError)
    .finally(() => setLoading(false));
}
function selectDiscipline(discipline) {
  selectedDiscipline = discipline;
  updateInfoDisplay();
  setupLevelScreen(discipline);
  setHeaderText("級を選択してください");
  showScreen("level-screen");
}
function selectLevel(level) {
  selectedLevel = level;
  updateInfoDisplay();
  setupEventScreen(selectedDiscipline, level);
  setHeaderText("種目を選択してください");
  showScreen("event-screen");
}
function selectEvent(event) {
  selectedEvent = event;
  updateInfoDisplay();
  nextSkier();
}

// === 入力と送信プロセス ===
function inputNumber(num) {
  if (currentScore.length < 2) {
    currentScore =
      currentScore === "0" && num !== "0"
        ? num
        : currentScore !== "0"
        ? currentScore + num
        : "0";
    const value = parseInt(currentScore) || 0;
    if (value <= 99)
      document.getElementById("score-display").textContent =
        currentScore || "0";
    else currentScore = currentScore.slice(0, -1);
  }
}
function clearInput() {
  currentScore = "";
  document.getElementById("score-display").textContent = "0";
}
function confirmScore() {
  const score = parseInt(currentScore) || 0;
  if (score < 0 || score > 99)
    return alert("得点は0-99の範囲で入力してください");
  confirmedScore = score;
  document.getElementById("confirmed-score").textContent = score;
  setHeaderText("ゼッケン番号を入力してください");
  showScreen("bib-screen");
}
function inputBibNumber(num) {
  if (currentBib.length < 3) {
    currentBib =
      currentBib === "0" && num !== "0"
        ? num
        : currentBib !== "0"
        ? currentBib + num
        : "0";
    const value = parseInt(currentBib) || 0;
    if (value <= 999)
      document.getElementById("bib-display").textContent = currentBib || "0";
    else currentBib = currentBib.slice(0, -1);
  }
}
function clearBibInput() {
  currentBib = "";
  document.getElementById("bib-display").textContent = "0";
}
function confirmBib() {
  const bib = parseInt(currentBib) || 0;
  if (bib < 1 || bib > 999)
    return alert("ゼッケン番号は1-999の範囲で入力してください");
  document.getElementById("final-bib").textContent = String(bib).padStart(
    3,
    "0"
  );
  document.getElementById("final-score").textContent = confirmedScore;
  setHeaderText("採点内容を確認してください");
  showScreen("submit-screen");
}
function submitEntry() {
  document.getElementById("submit-status").innerHTML =
    '<div class="status"><div class="loading"></div> 送信中...</div>';
  fetch("/api/submitScore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bib: parseInt(currentBib),
      score: confirmedScore,
      judge: currentJudge,
      discipline: selectedDiscipline,
      event: selectedEvent,
    }),
  })
    .then((response) => response.json())
    .then((result) => {
      if (result.error) throw new Error(result.error);
      onSubmitSuccess(result);
    })
    .catch(onSubmitError);
}
function onSubmitSuccess(result) {
  document.getElementById("completed-bib").textContent = String(
    result.bib
  ).padStart(3, "0");
  document.getElementById("completed-score").textContent = result.score;
  setHeaderText("送信完了しました");
  showScreen("complete-screen");
}

// === 確認ダイアログ関連 ===
function changeEvent() {
  showConfirmDialog("現在の採点を中断し、種目選択に戻りますか？", () => {
    selectedDiscipline = "";
    selectedLevel = "";
    selectedEvent = "";
    updateInfoDisplay();
    setHeaderText("種別を選択してください");
    showScreen("discipline-screen");
  });
}
function executeConfirm() {
  if (typeof onConfirmAction === "function") {
    onConfirmAction();
  }
  onConfirmAction = null;
}
function goBackToDisciplineSelect() {
  setHeaderText("種別を選択してください");
  showScreen("discipline-screen");
}
function goBackToLevelSelect() {
  setHeaderText("級を選択してください");
  showScreen("level-screen");
}
function goBack() {
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}
function editEntry() {
  currentScore = String(confirmedScore);
  document.getElementById("score-display").textContent = currentScore;
  setHeaderText("滑走者の得点を入力してください");
  showScreen("score-screen");
}
function showConfirmDialog(message, onConfirm) {
  previousScreen = document.querySelector(".screen.active").id;
  document.getElementById("confirm-message").textContent = message;
  onConfirmAction = onConfirm;
  showScreen("confirm-screen");
}
function cancelConfirm() {
  showScreen(previousScreen);
}

// === その他ヘルパー関数 ===
/**
 * 全ての採点結果をExcelファイルとしてエクスポートまたは共有する
 */
async function handleExportOrShare() {
  setLoading(true);
  setHeaderText("データを準備中...");

  try {
    const response = await fetch("/api/getResults");
    const data = await response.json();

    if (data.error) throw new Error(data.error);
    if (!data.results || data.results.length === 0) {
      alert("エクスポート/共有するデータがありません。");
      return;
    }

    const exportData = data.results.map((item) => ({
      採点日時: item.created_at
        ? new Date(item.created_at).toLocaleString("ja-JP")
        : "",
      ゼッケン: item.bib,
      得点: item.score,
      種別: item.discipline,
      種目: item.event_name,
      検定員: item.judge_name,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "採点結果");

    const fileName = "SAJ検定_全採点結果.xlsx";

    if (navigator.share) {
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const file = new File([blob], fileName, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "SAJ検定結果",
          text: "採点結果のExcelファイルです。",
          files: [file],
        });
      } else {
        XLSX.writeFile(workbook, fileName);
      }
    } else {
      XLSX.writeFile(workbook, fileName);
    }
  } catch (error) {
    // ユーザーによるキャンセル操作（AbortError）の場合は、エラーとして表示しない
    if (error.name === "AbortError") {
      console.log("共有はユーザーによってキャンセルされました。");
    } else {
      onApiError(error);
    }
  } finally {
    setLoading(false);
    const activeScreen = document.querySelector(".screen.active").id;
    if (activeScreen === "complete-screen") {
      setHeaderText("送信完了しました");
    } else if (activeScreen === "judge-screen") {
      setHeaderText("検定員を選択してください");
    }
  }
}

function createButton(parent, text, onClick) {
  const btn = document.createElement("button");
  btn.className = "key select-item";
  btn.textContent = text;
  btn.onclick = onClick;
  parent.appendChild(btn);
}
function showScreen(screenId) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}
function setHeaderText(text) {
  document.getElementById("header-main-text").textContent = text;
}
function setInstruction(id, text) {
  document.getElementById(id).textContent = text;
}
function setLoading(isLoading) {
  document
    .getElementById("loading-overlay")
    .classList.toggle("active", isLoading);
}
function updateInfoDisplay() {
  document.getElementById("current-judge-display").textContent =
    currentJudge || "--";
  document.getElementById("current-discipline-display").textContent =
    selectedDiscipline || "--";
  document.getElementById("current-level-display").textContent =
    selectedLevel || "--";
  document.getElementById("current-event-display").textContent =
    selectedEvent || "--";
}
function onApiError(error) {
  alert("サーバーとの通信エラー: " + error.message);
  setLoading(false);
}
function onSubmitError(error) {
  document.getElementById(
    "submit-status"
  ).innerHTML = `<div class="error">送信エラー: ${error.message}<br><button class="nav-btn" onclick="submitEntry()">再試行</button></div>`;
}
