// =====================================================
// LINE Sticker Studio 用アクション（貼り付け用）
// =====================================================
//
// ⚠️ このリポジトリの gas/ は稼働中の GAS デプロイとは別物です。
//    以下の手順で反映してください。
//
//    1. このファイルの中身を、稼働中の GAS プロジェクトの Code.gs の末尾に貼り付ける
//    2. doPost のアクション振り分けに、下の3行を追加する
//         if (action === "sticker_get")     return stickerGet_(body);
//         if (action === "sticker_save")    return stickerSave_(body);
//         if (action === "sticker_credits") return stickerCredits_(body);
//       （Code.gs には振り分けが2箇所あります。bp_lock を検索して両方に追加してください）
//    3. 「デプロイ」→「デプロイを管理」→ 既存デプロイの鉛筆アイコン
//       → バージョンを「新バージョン」にして更新
//
//    シート（sticker_projects）は初回アクセス時に自動で作られます。
//
// 依存している既存ヘルパー: str_ / num_ / json_
//
// 設計上の約束:
//    credits 列は stickerCredits_ だけが書き換えます。
//    stickerSave_ は credits を一切触りません。
//    これによりクライアントがクレジットを増やすことができません。

var STICKER_SHEET_NAME = "sticker_projects";
var STICKER_HEADER = [
  "project_id", "user_id", "name", "status",
  "credits", "project_json", "created_at", "updated_at"
];
// スプレッドシートのセル上限（50000文字）に対する安全マージン
var STICKER_JSON_MAX = 45000;

function stickerSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(STICKER_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(STICKER_SHEET_NAME);
    sh.appendRow(STICKER_HEADER);
  }
  return sh;
}

function stickerIdx_(header) {
  return {
    projectId: header.indexOf("project_id"),
    userId:    header.indexOf("user_id"),
    name:      header.indexOf("name"),
    status:    header.indexOf("status"),
    credits:   header.indexOf("credits"),
    json:      header.indexOf("project_json"),
    createdAt: header.indexOf("created_at"),
    updatedAt: header.indexOf("updated_at")
  };
}

// 該当ユーザー・該当プロジェクトの行番号（1始まり・ヘッダー込み）を返す。無ければ -1
function stickerFindRow_(data, idx, userId, projectId) {
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.userId]) === userId &&
        String(data[i][idx.projectId]) === projectId) {
      return i + 1;
    }
  }
  return -1;
}

// action: sticker_get
// body: { id, project_id }
// project_id を省略すると、そのユーザーのプロジェクト一覧を新しい順に返す
function stickerGet_(body) {
  try {
    var id = str_(body.id);
    var projectId = str_(body.project_id || "");
    if (!id) return json_({ ok: false, error: "invalid_params" });

    var sh = stickerSheet_();
    var data = sh.getDataRange().getValues();
    if (data.length < 2) return json_({ ok: true, projects: [], project: null, credits: 0 });

    var idx = stickerIdx_(data[0]);
    var rows = [];

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idx.userId]) !== id) continue;
      if (projectId && String(data[i][idx.projectId]) !== projectId) continue;
      rows.push({
        project_id:   String(data[i][idx.projectId]),
        name:         String(data[i][idx.name]),
        status:       String(data[i][idx.status]),
        credits:      num_(data[i][idx.credits]),
        project_json: String(data[i][idx.json] || ""),
        created_at:   String(data[i][idx.createdAt]),
        updated_at:   String(data[i][idx.updatedAt])
      });
    }

    // 更新が新しい順
    rows.sort(function(a, b) {
      return a.updated_at < b.updated_at ? 1 : (a.updated_at > b.updated_at ? -1 : 0);
    });

    return json_({
      ok: true,
      projects: rows,
      project: rows.length ? rows[0] : null,
      credits: rows.length ? rows[0].credits : 0
    });
  } catch (e) {
    return json_({ ok: false, error: String(e) });
  }
}

// action: sticker_save
// body: { id, project_id, name, status, project_json }
// credits 列は書き換えない（stickerCredits_ の専任）
function stickerSave_(body) {
  try {
    var id        = str_(body.id);
    var projectId = str_(body.project_id);
    var name      = str_(body.name || "");
    var status    = str_(body.status || "draft");
    var payload   = str_(body.project_json || "");

    if (!id || !projectId) return json_({ ok: false, error: "invalid_params" });
    if (payload.length > STICKER_JSON_MAX) {
      return json_({ ok: false, error: "project_too_large" });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = stickerSheet_();
      var data = sh.getDataRange().getValues();
      var idx = stickerIdx_(data[0]);
      var now = new Date().toISOString();
      var row = stickerFindRow_(data, idx, id, projectId);

      if (row < 0) {
        sh.appendRow([projectId, id, name, status, 0, payload, now, now]);
        return json_({ ok: true, credits: 0 });
      }

      sh.getRange(row, idx.name + 1).setValue(name);
      sh.getRange(row, idx.status + 1).setValue(status);
      sh.getRange(row, idx.json + 1).setValue(payload);
      sh.getRange(row, idx.updatedAt + 1).setValue(now);

      return json_({ ok: true, credits: num_(sh.getRange(row, idx.credits + 1).getValue()) });
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return json_({ ok: false, error: String(e) });
  }
}

// action: sticker_credits
// body: { id, project_id, delta }
// 生成クレジットを原子的に増減する。0未満にはならない。
// delta が負で残高が足りないときは ok:false / error:"no_credits" を返す。
function stickerCredits_(body) {
  try {
    var id        = str_(body.id);
    var projectId = str_(body.project_id);
    var delta     = num_(body.delta);

    if (!id || !projectId || !delta) return json_({ ok: false, error: "invalid_params" });

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = stickerSheet_();
      var data = sh.getDataRange().getValues();
      var idx = stickerIdx_(data[0]);
      var now = new Date().toISOString();
      var row = stickerFindRow_(data, idx, id, projectId);

      // 行がまだ無い状態で付与された場合はその場で作る（start が save より先に走ったとき）
      if (row < 0) {
        if (delta < 0) return json_({ ok: false, error: "no_credits", credits: 0 });
        sh.appendRow([projectId, id, "", "rendering", delta, "", now, now]);
        return json_({ ok: true, credits: delta });
      }

      var current = num_(sh.getRange(row, idx.credits + 1).getValue());
      var next = current + delta;
      if (next < 0) {
        return json_({ ok: false, error: "no_credits", credits: current });
      }

      sh.getRange(row, idx.credits + 1).setValue(next);
      sh.getRange(row, idx.updatedAt + 1).setValue(now);
      return json_({ ok: true, credits: next });
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return json_({ ok: false, error: String(e) });
  }
}
