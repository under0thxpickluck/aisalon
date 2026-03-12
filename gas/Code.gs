// ==============================
// LIFAI GAS WebApp (POST/GET 安全対応) - 完全統合版（RESET TOKEN + MAIL）Code.gs
// ✅ 既存機能は削除しない（apply_create / payment_update / apply / admin_list / admin_approve / login）
// ✅ 追加機能：reset_password + reset_token列 + Mail送信
// ✅ 構造を壊さないため、各action内で必要列を必ず ensureCols_ してから idx を作る
// ✅ 追加機能（今回）：紹介コード発行 + 紹介者紐づけ(最大3段追跡) + ref_tree自動生成 + ref_events記録
// ✅ 追加機能（今回）：me（ログイン済ユーザーの紹介情報を返す）
// ✅ 追加機能（今回）：get_balance（BP/EP残高取得）
// ✅ 追加修正（今回）：ref_tree_build の getDataRange() を安全化（巨大DataRangeで落ちるサーバーエラー回避）
// ✅ 追加改善（今回）：payment_update で金額OKなら自動承認 + 自動メール送信、NGは pending_error に残す（壊さない）
// ✅ 追加改善（今回）：NOWPaymentsの pay_amount/pay_currency/price_amount/price_currency を保存（壊さない）
// ✅ 追加機能（今回）：approved になった瞬間にBP/EPを付与（bp_granted_at で二重付与防止）（壊さない）
// ==============================

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("LIFAI")
      .addItem("紹介ツリー更新", "buildRefTreeManual_")
      .addToUi();
  } catch (e) {
    // WebApp実行時などUIが無い場合は何もしない（壊さない）
  }
}

function buildRefTreeManual_() {
  // 管理者がシートから実行する用（壊さない）
  // adminKey はスクリプトプロパティの ADMIN_SECRET を使う
  const secrets = getSecrets_();
  const body = { action: "ref_tree_build", adminKey: secrets.ADMIN_SECRET };
  // pickKey_ は不要（シート実行は handle_ 直で呼ぶ）
  return handle_(secrets.SECRET, body);
}

function doGet(e) {
  try {
    const key = pickKey_(e);
    const action = str_(e?.parameter?.action);

    const pseudoBody = {
      action,

      // admin系
      adminKey: str_(e?.parameter?.adminKey),
      rowIndex: num_(e?.parameter?.rowIndex),

      // login/me系（GET互換）
      id: str_(e?.parameter?.id),
      code: str_(e?.parameter?.code),

      // apply系
      plan: str_(e?.parameter?.plan),
      email: str_(e?.parameter?.email),
      name: str_(e?.parameter?.name),
      nameKana: str_(e?.parameter?.nameKana),
      discordId: str_(e?.parameter?.discordId),
      ageBand: str_(e?.parameter?.ageBand),
      prefecture: str_(e?.parameter?.prefecture),
      city: str_(e?.parameter?.city),
      job: str_(e?.parameter?.job),
      refName: str_(e?.parameter?.refName),
      refId: str_(e?.parameter?.refId),

      // ✅ 紹介コード（今回追加：壊さない）
      refCode: str_(e?.parameter?.refCode),

      // 互換用（古い region が来ても壊れない）
      region: str_(e?.parameter?.region),

      applyId: str_(e?.parameter?.applyId),

      // payment_update系
      orderId: str_(e?.parameter?.orderId),
      paymentStatus: str_(e?.parameter?.paymentStatus),
      isPaid: str_(e?.parameter?.isPaid),
      invoiceId: str_(e?.parameter?.invoiceId),
      actuallyPaid: str_(e?.parameter?.actuallyPaid),

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      payAmount: str_(e?.parameter?.payAmount),
      payCurrency: str_(e?.parameter?.payCurrency),
      priceAmount: str_(e?.parameter?.priceAmount),
      priceCurrency: str_(e?.parameter?.priceCurrency),

      // reset_password系
      token: str_(e?.parameter?.token),
      password: str_(e?.parameter?.password),
    };

    if (!action) {
      return json_({ ok: false, error: "method_not_allowed" });
    }

    return handle_(key, pseudoBody);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const key = pickKey_(e);
    const body = JSON.parse(e?.postData?.contents || "{}");
    return handle_(key, body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function handle_(key, body) {
  const secrets = getSecrets_();
  const SECRET = secrets.SECRET;
  const ADMIN_SECRET = secrets.ADMIN_SECRET;

  if (key !== SECRET) return json_({ ok: false, error: "unauthorized" });

  const sheet = getOrCreateSheet_();
  const action = str_(body.action);

  // =========================================================
  // 0) apply_create（仮登録：purchase時）
  // =========================================================
  if (action === "apply_create") {
    const plan = str_(body.plan);
    const applyId = str_(body.applyId);

    if (!plan || !applyId) {
      return json_({ ok: false, error: "missing_plan_or_applyId" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, [
      "apply_id",
      "payment_status",
      "paid_at",
      "order_id",
      "invoice_id",
      "actually_paid",

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      "pay_amount",
      "pay_currency",
      "price_amount",
      "price_currency",

      "discord_id",
      "age_band",
      "prefecture",
      "city",
      "job",
      "ref_name",
      "ref_id",
      "region",
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",

      // ✅ 紹介コード（今回追加：壊さない）
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ref_path",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    // 既に存在するかチェック（重複防止）
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["apply_id"]]) === applyId) {
        // 既存行がある場合でも expected_paid が空なら埋める（壊さない）
        try {
          const rowIndex = i + 2;
          const curExpected = sheet.getRange(rowIndex, idx["expected_paid"] + 1).getValue();
          if (!curExpected) {
            const exp = planToExpectedPaid_(plan);
            if (exp > 0) {
              sheet.getRange(rowIndex, idx["expected_paid"] + 1).setValue(exp);
            }
          }
        } catch (e) {}
        return json_({ ok: true, already_exists: true });
      }
    }

    const row = new Array(header.length).fill("");
    row[idx["created_at"]] = new Date();
    row[idx["plan"]] = plan;
    row[idx["status"]] = "pending_payment";
    row[idx["apply_id"]] = applyId;

    // ✅ 期待金額（自動承認用）
    const exp = planToExpectedPaid_(plan);
    if (exp > 0) {
      row[idx["expected_paid"]] = exp;
    } else {
      row[idx["expected_paid"]] = "";
    }

    sheet.appendRow(row);
    return json_({ ok: true });
  }

  // =========================================================
  // 1) payment_update（着金ステータス更新）
  // ✅ 追加：金額OKなら自動承認 + メール送信、NGは pending_error に残す（壊さない）
  // =========================================================
  if (action === "payment_update") {
    const applyId = str_(body.applyId);
    const orderId = str_(body.orderId);
    const paymentStatus = str_(body.paymentStatus);
    const invoiceId = str_(body.invoiceId);
    const actuallyPaid = str_(body.actuallyPaid);

    // ✅ NOWPayments金額・通貨（今回追加：壊さない）
    const payAmount = str_(body.payAmount || body.pay_amount);
    const payCurrency = str_(body.payCurrency || body.pay_currency);
    const priceAmount = str_(body.priceAmount || body.price_amount);
    const priceCurrency = str_(body.priceCurrency || body.price_currency);

    if (!applyId && !orderId) {
      return json_({ ok: false, error: "missing_applyId_or_orderId" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "apply_id",
      "payment_status",
      "paid_at",
      "order_id",
      "invoice_id",
      "actually_paid",

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      "pay_amount",
      "pay_currency",
      "price_amount",
      "price_currency",

      "status",
      "plan",
      "email",

      // ✅ admin_approveと共通化のために必要列（壊さない）
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ref_path",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let targetRowIndex = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;

      if (applyId && str_(rows[i][idx["apply_id"]]) === applyId) {
        targetRowIndex = rowIndex;
        break;
      }
      if (!applyId && orderId && str_(rows[i][idx["order_id"]]) === orderId) {
        targetRowIndex = rowIndex;
        break;
      }
      // 念のため：applyIdとorderId両方来た場合
      if (applyId && orderId && str_(rows[i][idx["order_id"]]) === orderId) {
        targetRowIndex = rowIndex;
        break;
      }
    }

    if (!targetRowIndex) {
      return json_({ ok: false, error: "apply_not_found" });
    }

    sheet.getRange(targetRowIndex, idx["payment_status"] + 1).setValue(paymentStatus);
    sheet.getRange(targetRowIndex, idx["order_id"] + 1).setValue(orderId);
    sheet.getRange(targetRowIndex, idx["invoice_id"] + 1).setValue(invoiceId);
    sheet.getRange(targetRowIndex, idx["actually_paid"] + 1).setValue(actuallyPaid);

    // ✅ NOWPayments金額・通貨を保存（壊さない）
    if (idx["pay_amount"] !== undefined) sheet.getRange(targetRowIndex, idx["pay_amount"] + 1).setValue(payAmount);
    if (idx["pay_currency"] !== undefined) sheet.getRange(targetRowIndex, idx["pay_currency"] + 1).setValue(payCurrency);
    if (idx["price_amount"] !== undefined) sheet.getRange(targetRowIndex, idx["price_amount"] + 1).setValue(priceAmount);
    if (idx["price_currency"] !== undefined) sheet.getRange(targetRowIndex, idx["price_currency"] + 1).setValue(priceCurrency);

    // isPaid は boolean/文字列 "true"/"1" も拾う
    const paid =
      body.isPaid === true ||
      String(body.isPaid).toLowerCase() === "true" ||
      String(body.isPaid) === "1";

    // ✅ paid の確定ステータス（壊さない）
    const paidOk =
      paid && (paymentStatus === "finished" || paymentStatus === "confirmed" || paymentStatus === "paid");

    if (paidOk) {
      sheet.getRange(targetRowIndex, idx["paid_at"] + 1).setValue(new Date());
      sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("paid");
    }

    // ✅ 自動承認判定（壊さない）
    // - 原則：confirmed / finished のみ自動承認対象（paid でも来る場合があるので許容）
    // - 金額が判定できない/不足/メール無し/plan不明などは pending_error に残す
    // - 二重送信防止：reset_sent_at があれば送らない
    let autoApproved = false;
    let autoReason = "";

    if (paidOk) {
      const curStatus = str_(sheet.getRange(targetRowIndex, idx["status"] + 1).getValue());

      // approved 済みなら何もしない（壊さない）
      if (curStatus === "approved") {
        autoApproved = false;
        autoReason = "already_approved";
      } else {
        // email 必須（applyが未入力だとここで落とす）
        const email = str_(sheet.getRange(targetRowIndex, idx["email"] + 1).getValue());
        if (!email) {
          sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
          sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("no_email");
          autoApproved = false;
          autoReason = "no_email";
        } else {
          // expected_paid の確定（空なら plan から埋める）
          const plan = str_(sheet.getRange(targetRowIndex, idx["plan"] + 1).getValue());
          let expected = Number(sheet.getRange(targetRowIndex, idx["expected_paid"] + 1).getValue() || 0);
          if (!expected || !Number.isFinite(expected) || expected <= 0) {
            const exp2 = planToExpectedPaid_(plan);
            if (exp2 > 0) {
              expected = exp2;
              sheet.getRange(targetRowIndex, idx["expected_paid"] + 1).setValue(expected);
            }
          }

          // ✅ 支払い額の優先順位：pay_amount -> actually_paid（壊さない）
          const payAmountCell =
            idx["pay_amount"] !== undefined ? sheet.getRange(targetRowIndex, idx["pay_amount"] + 1).getValue() : "";
          const apPay = parseMoneyLike_(payAmountCell);
          const apFallback = parseMoneyLike_(sheet.getRange(targetRowIndex, idx["actually_paid"] + 1).getValue());
          const ap = apPay > 0 ? apPay : apFallback;
          const TOLERANCE_PCT = 2;
          const expectedOk = expected > 0 && Number.isFinite(expected);
          const paidAmountOk = expectedOk && ap >= expected * (1 - TOLERANCE_PCT / 100);

          if (!expectedOk) {
            sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
            sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("expected_unknown");
            autoApproved = false;
            autoReason = "expected_unknown";
          } else if (!Number.isFinite(ap) || ap <= 0) {
            sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
            sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("actually_paid_invalid");
            autoApproved = false;
            autoReason = "actually_paid_invalid";
          } else if (!paidAmountOk) {
            sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
            sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue(
              "paid_too_low: " + String(ap) + " < " + String(expected)
            );
            autoApproved = false;
            autoReason = "paid_too_low";
          } else {
            // 二重送信防止（reset_sent_at があれば送らない）
            const sentAt = sheet.getRange(targetRowIndex, idx["reset_sent_at"] + 1).getValue();
            if (sentAt) {
              // 送信済みなら approved だけ整合させる（壊さない）
              sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("approved");
              autoApproved = false;
              autoReason = "already_sent";
              sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("already_sent");
            } else {
              // ✅ admin_approve と同じ処理を実行（共通化）
              const res = approveRowCore_(sheet, header, idx, targetRowIndex, "auto_payment_update");
              if (res && res.ok) {
                autoApproved = true;
                autoReason = "auto_approved";
                sheet.getRange(targetRowIndex, idx["auto_approved_at"] + 1).setValue(new Date());
                sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue("auto_payment_update_ok");
              } else {
                sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending_error");
                sheet.getRange(targetRowIndex, idx["auto_approve_reason"] + 1).setValue(
                  "approve_failed: " + (res && res.error ? String(res.error) : "unknown")
                );
                autoApproved = false;
                autoReason = "approve_failed";
              }
            }
          }
        }
      }
    }

    return json_({ ok: true, autoApproved: autoApproved, autoReason: autoReason });
  }

  // =========================================================
  // 2) apply（申請フォーム：apply_id の行を更新）
  // =========================================================
  if (action === "apply") {
    const plan = str_(body.plan);
    const email = str_(body.email);
    const name = str_(body.name);
    const nameKana = str_(body.nameKana);

    if (!plan || !email || !name || !nameKana) {
      return json_({ ok: false, error: "missing_fields" });
    }

    const applyId = str_(body.applyId);
    if (!applyId) {
      return json_({ ok: false, error: "missing_applyId" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "apply_id",
      "plan",
      "email",
      "name",
      "name_kana",
      "discord_id",
      "age_band",
      "prefecture",
      "city",
      "job",
      "ref_name",
      "ref_id",
      "region",
      "status",

      // ✅ 紹介コード（今回追加：壊さない）
      "ref_code",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",

      // ✅ Bug Fix: 支払済み判定に必要（壊さない）
      "paid_at",
      "reset_sent_at",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let targetRowIndex = 0;
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;
      if (str_(rows[i][idx["apply_id"]]) === applyId) {
        targetRowIndex = rowIndex;
        break;
      }
    }

    // 見つからない場合は互換で新規作成（既存設計を維持）
    if (!targetRowIndex) {
      const row = new Array(header.length).fill("");
      row[idx["created_at"]] = new Date();
      row[idx["plan"]] = plan;
      row[idx["email"]] = email;
      row[idx["name"]] = name;
      row[idx["name_kana"]] = nameKana;
      row[idx["ref_name"]] = str_(body.refName);
      row[idx["ref_id"]] = str_(body.refId);
      row[idx["discord_id"]] = str_(body.discordId);
      row[idx["age_band"]] = str_(body.ageBand);
      row[idx["prefecture"]] = str_(body.prefecture);
      row[idx["city"]] = str_(body.city);
      row[idx["job"]] = str_(body.job);

      const pref = str_(body.prefecture);
      const region = str_(body.region);
      row[idx["region"]] = region || pref;

      // ✅ 今回追加：入力された紹介コードを保存（壊さない）
      row[idx["ref_code"]] = str_(body.refCode);

      // ✅ 期待金額（自動承認用）
      const exp = planToExpectedPaid_(plan);
      if (exp > 0) {
        row[idx["expected_paid"]] = exp;
      } else {
        row[idx["expected_paid"]] = "";
      }

      row[idx["status"]] = "pending";
      row[idx["apply_id"]] = applyId;

      sheet.appendRow(row);
      return json_({ ok: true, created_new: true });
    }

    // 既存行を更新（既存仕様を維持）
    sheet.getRange(targetRowIndex, idx["plan"] + 1).setValue(plan);
    sheet.getRange(targetRowIndex, idx["email"] + 1).setValue(email);
    sheet.getRange(targetRowIndex, idx["name"] + 1).setValue(name);
    sheet.getRange(targetRowIndex, idx["name_kana"] + 1).setValue(nameKana);
    sheet.getRange(targetRowIndex, idx["ref_name"] + 1).setValue(str_(body.refName));
    sheet.getRange(targetRowIndex, idx["ref_id"] + 1).setValue(str_(body.refId));

    sheet.getRange(targetRowIndex, idx["discord_id"] + 1).setValue(str_(body.discordId));
    sheet.getRange(targetRowIndex, idx["age_band"] + 1).setValue(str_(body.ageBand));
    sheet.getRange(targetRowIndex, idx["prefecture"] + 1).setValue(str_(body.prefecture));
    sheet.getRange(targetRowIndex, idx["city"] + 1).setValue(str_(body.city));
    sheet.getRange(targetRowIndex, idx["job"] + 1).setValue(str_(body.job));

    const currentRegion = sheet.getRange(targetRowIndex, idx["region"] + 1).getValue();
    if (!currentRegion) {
      sheet.getRange(targetRowIndex, idx["region"] + 1).setValue(str_(body.prefecture) || str_(body.region));
    }

    // ✅ 今回追加：入力された紹介コードを保存（壊さない）
    sheet.getRange(targetRowIndex, idx["ref_code"] + 1).setValue(str_(body.refCode));

    // ✅ 期待金額（自動承認用）plan変更があり得るので空なら埋める（壊さない）
    const curExpected = sheet.getRange(targetRowIndex, idx["expected_paid"] + 1).getValue();
    if (!curExpected) {
      const exp = planToExpectedPaid_(plan);
      if (exp > 0) {
        sheet.getRange(targetRowIndex, idx["expected_paid"] + 1).setValue(exp);
      }
    }

    // status は paid / approved を上書きしない（既存仕様維持）
    const curStatus = str_(sheet.getRange(targetRowIndex, idx["status"] + 1).getValue());
    if (curStatus !== "paid" && curStatus !== "approved") {
      sheet.getRange(targetRowIndex, idx["status"] + 1).setValue("pending");
    }

    // ✅ Bug Fix: IPNがフォーム送信前に届いてemail空でpending_errorになった場合の救済
    // 支払済み（paid_at あり）+ email が今回セットされた + メール未送信 + 未承認 → 自動承認をトリガー
    try {
      const emailNow = str_(sheet.getRange(targetRowIndex, idx["email"] + 1).getValue());
      const paidAt = idx["paid_at"] !== undefined ? sheet.getRange(targetRowIndex, idx["paid_at"] + 1).getValue() : "";
      const sentAt = idx["reset_sent_at"] !== undefined ? sheet.getRange(targetRowIndex, idx["reset_sent_at"] + 1).getValue() : "";
      const latestStatus = str_(sheet.getRange(targetRowIndex, idx["status"] + 1).getValue());
      if (emailNow && paidAt && !sentAt && latestStatus !== "approved") {
        approveRowCore_(sheet, header, idx, targetRowIndex, "apply_late_trigger");
      }
    } catch (e) {
      // 失敗しても apply 自体は成功として返す（壊さない）
    }

    return json_({ ok: true, updated: true });
  }

  // =========================================================
  // admin_list（管理：一覧）
  // =========================================================
  if (action === "admin_list") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 参照列保証（壊さない）
    ensureCols_(sheet, header, [
      "created_at",
      "plan",
      "email",
      "name",
      "status",
      "apply_id",
      "login_id",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",
      "actually_paid",

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      "pay_amount",
      "pay_currency",
      "price_amount",
      "price_currency",

      "payment_status",
      "order_id",
      "invoice_id",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    if (!values || values.length < 2) return json_({ ok: true, items: [] });

    const rows = values.slice(1);
    const idx = indexMap_(header);

    const items = rows.map((r, i) => ({
      rowIndex: i + 2,
      created_at: r[idx["created_at"]],
      plan: r[idx["plan"]],
      email: r[idx["email"]],
      name: r[idx["name"]],
      status: r[idx["status"]],
      apply_id: r[idx["apply_id"]],
      login_id: r[idx["login_id"]],

      // ✅ 追加（壊さない）
      expected_paid: r[idx["expected_paid"]],
      auto_approved_at: r[idx["auto_approved_at"]],
      auto_approve_reason: r[idx["auto_approve_reason"]],
      actually_paid: r[idx["actually_paid"]],

      // ✅ NOWPayments金額・通貨（今回追加：壊さない）
      pay_amount: r[idx["pay_amount"]],
      pay_currency: r[idx["pay_currency"]],
      price_amount: r[idx["price_amount"]],
      price_currency: r[idx["price_currency"]],

      payment_status: r[idx["payment_status"]],
      order_id: r[idx["order_id"]],
      invoice_id: r[idx["invoice_id"]],

      // ✅ BP/EP付与（今回追加：壊さない）
      bp_balance: r[idx["bp_balance"]],
      ep_balance: r[idx["ep_balance"]],
      bp_granted_at: r[idx["bp_granted_at"]],
      bp_grant_plan: r[idx["bp_grant_plan"]],
      bp_grant_amount: r[idx["bp_grant_amount"]],
      ep_grant_amount: r[idx["ep_grant_amount"]],

      // ✅ 紹介配当（今回追加：壊さない）
      ref_share_pct: r[idx["ref_share_pct"]],
      ref_bonus_granted_at: r[idx["ref_bonus_granted_at"]],
      ref_bonus_amount: r[idx["ref_bonus_amount"]],
    }));

    return json_({ ok: true, items: items });
  }

  // =========================================================
  // admin_approve（承認 + RESET TOKEN発行 + メール送信）
  // ※ 旧仕様：ID/PW発行（tempPassword）は削除せず補助関数も残すが、ここでは使わない
  // ✅ 追加：紹介コード発行 + 紹介紐づけ(最大3段) + ref_events記録
  // =========================================================
  if (action === "admin_approve") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const rowIndex = Number(body.rowIndex || 0);
    if (!rowIndex || rowIndex < 2) return json_({ ok: false, error: "bad_row" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "email",
      "status",
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",

      // ✅ 紹介コード（今回追加：壊さない）
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ref_path",

      // ✅ 自動承認（今回追加：壊さない）
      "expected_paid",
      "auto_approved_at",
      "auto_approve_reason",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx = indexMap_(header);

    // ✅ 共通の承認コアを実行（壊さない）
    const res = approveRowCore_(sheet, header, idx, rowIndex, "admin_approve");

    // ✅ admin_approve は従来の返り値も維持したいので、それを含めて返す（壊さない）
    if (res && res.ok) {
      return json_({
        ok: true,
        loginId: res.loginId,
        resetSent: res.resetSent,
        myRefCode: res.myRefCode,
        refBound: res.refBound,
        bpGranted: res.bpGranted,
        bpAdded: res.bpAdded,
        epAdded: res.epAdded,
        refBonusGranted: res.refBonusGranted,
        refBonusAmount: res.refBonusAmount,
      });
    } else {
      return json_({ ok: false, error: res && res.error ? res.error : "approve_failed" });
    }
  }

  // =========================================================
  // =========================================================
  // admin_dashboard（管理ダッシュボード集計）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - 会員サマリー / ガチャ / ステーキング / RADIO 統計を返す
  // =========================================================
  if (action === "admin_dashboard") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    // applies シート集計
    const values = sheet.getDataRange().getValues();
    const header = values[0];
    const idx    = indexMap_(header);
    const rows   = values.slice(1);

    let totalMembers  = 0;
    let pendingCount  = 0;
    let totalBpIssued = 0;
    let totalEpIssued = 0;
    const members = [];

    for (let i = 0; i < rows.length; i++) {
      const r      = rows[i];
      const status = str_(r[idx["status"]]);
      if (status === "approved") {
        totalMembers++;
        totalBpIssued += Number(r[idx["bp_balance"]] || 0);
        totalEpIssued += Number(r[idx["ep_balance"]] || 0);
        members.push({
          login_id:          str_(r[idx["login_id"]]),
          name:              str_(r[idx["name"]]),
          email:             str_(r[idx["email"]]),
          plan:              str_(r[idx["plan"]]),
          status:            status,
          created_at:        r[idx["created_at"]] ? new Date(r[idx["created_at"]]).toISOString() : "",
          bp_balance:        Number(r[idx["bp_balance"]] || 0),
          ep_balance:        Number(r[idx["ep_balance"]] || 0),
          login_streak:      Number(r[idx["login_streak"]] || 0),
          total_login_count: Number(r[idx["total_login_count"]] || 0),
          subscription_plan: str_(r[idx["subscription_plan"]]),
          last_login_at:     r[idx["last_login_at"]] ? new Date(r[idx["last_login_at"]]).toISOString() : "",
        });
      } else if (status === "pending" || status === "paid" || status === "pending_payment") {
        pendingCount++;
      }
    }

    // staking シート集計
    const stakingSheet = getOrCreateStakingSheet_();
    const sValues = stakingSheet.getDataRange().getValues();
    const sHeader = sValues[0];
    const sIdx    = indexMap_(sHeader);
    const sRows   = sValues.slice(1);
    let activeCount    = 0;
    let totalStakedBp  = 0;
    let claimableCount = 0;
    const nowMs = Date.now();
    for (let i = 0; i < sRows.length; i++) {
      const r      = sRows[i];
      const status = str_(r[sIdx["status"]]);
      if (status === "active") {
        activeCount++;
        totalStakedBp += Number(r[sIdx["staked_bp"]] || 0);
        const expiresAt = r[sIdx["expires_at"]];
        if (expiresAt && new Date(expiresAt).getTime() < nowMs) claimableCount++;
      }
    }

    // wallet_ledger シート集計（ガチャ）
    const ss  = SpreadsheetApp.getActiveSpreadsheet();
    const led = getOrCreateSheetByName_(ss, "wallet_ledger", ["ts","kind","login_id","email","amount","memo"]);
    const lValues = led.getDataRange().getValues();
    const lHeader = lValues[0];
    const lIdx    = indexMap_(lHeader);
    const lRows   = lValues.slice(1);
    let totalSpins   = 0;
    let totalCostBp  = 0;
    let totalPrizeBp = 0;
    for (let i = 0; i < lRows.length; i++) {
      const kind = str_(lRows[i][lIdx["kind"]]);
      const amt  = Number(lRows[i][lIdx["amount"]] || 0);
      if (kind === "gacha_cost")  { totalSpins++; totalCostBp  += Math.abs(amt); }
      if (kind === "gacha_prize") { totalPrizeBp += amt; }
    }

    // radio_missions シート集計
    const mSheet  = getOrCreateRadioMissionsSheet_();
    const mValues = mSheet.getDataRange().getValues();
    const mHeader = mValues[0];
    const mIdx    = indexMap_(mHeader);
    const mRows   = mValues.slice(1);
    let totalSubmissions = 0;
    let totalEpGranted   = 0;
    for (let i = 0; i < mRows.length; i++) {
      if (str_(mRows[i][mIdx["status"]]) === "approved") {
        totalSubmissions++;
        totalEpGranted += Number(mRows[i][mIdx["ep_granted"]] || 0);
      }
    }

    return json_({
      ok: true,
      summary: {
        total_members:   totalMembers,
        pending_count:   pendingCount,
        total_bp_issued: totalBpIssued,
        total_ep_issued: totalEpIssued,
      },
      members: members,
      staking_summary: {
        active_count:    activeCount,
        total_staked_bp: totalStakedBp,
        claimable_count: claimableCount,
      },
      gacha_summary: {
        total_spins:    totalSpins,
        total_cost_bp:  totalCostBp,
        total_prize_bp: totalPrizeBp,
      },
      radio_summary: {
        total_submissions: totalSubmissions,
        total_ep_granted:  totalEpGranted,
      },
    });
  }

  // =========================================================
  // admin_get_members（会員一覧ページネーション）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - page / pageSize で approved 会員を返す
  // =========================================================
  if (action === "admin_get_members") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const page     = Math.max(0, Number(body.page     || 0));
    const pageSize = Math.min(100, Math.max(1, Number(body.pageSize || 20)));

    const values = sheet.getDataRange().getValues();
    const header = values[0];
    const idx    = indexMap_(header);
    const rows   = values.slice(1);

    const approved = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (str_(r[idx["status"]]) !== "approved") continue;
      approved.push({
        login_id:          str_(r[idx["login_id"]]),
        name:              str_(r[idx["name"]]),
        email:             str_(r[idx["email"]]),
        plan:              str_(r[idx["plan"]]),
        status:            "approved",
        created_at:        r[idx["created_at"]] ? new Date(r[idx["created_at"]]).toISOString() : "",
        bp_balance:        Number(r[idx["bp_balance"]] || 0),
        ep_balance:        Number(r[idx["ep_balance"]] || 0),
        login_streak:      Number(r[idx["login_streak"]] || 0),
        total_login_count: Number(r[idx["total_login_count"]] || 0),
        subscription_plan: str_(r[idx["subscription_plan"]]),
        last_login_at:     r[idx["last_login_at"]] ? new Date(r[idx["last_login_at"]]).toISOString() : "",
      });
    }

    // created_at 降順ソート
    approved.sort(function(a, b) {
      return (b.created_at || "") < (a.created_at || "") ? -1 : 1;
    });

    const start   = page * pageSize;
    const sliced  = approved.slice(start, start + pageSize);

    return json_({
      ok:       true,
      members:  sliced,
      total:    approved.length,
      page:     page,
      pageSize: pageSize,
    });
  }

  // ✅ ref_tree_build（管理：ツリー表示専用シート ref_tree を再生成）
  // - データの正本は applies（壊さない）
  // - 表示用に ref_tree を全消し→再生成
  // ✅ 改善：getDataRange() を安全化（巨大DataRangeで落ちるサーバーエラー回避）
  // ✅ 改善：out 完成後に clear する（途中失敗で ref_tree が空になる事故を防ぐ）
  // ✅ 改善：setValues を分割（保険）
  // =========================================================
  if (action === "ref_tree_build") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const applies = getOrCreateSheet_();

    // ref_tree / ref_events は無ければ作る（壊さない）
    const treeSheet = getOrCreateSheetByName_(ss, "ref_tree", [
      "L1",
      "L1_direct_count",
      "L2",
      "L2_direct_count",
      "L3",
      "L3_status",
      "L3_email",
      "L3_created_at",
      "L1_share_pct",
      "L1_bonus_total",
      "L2_share_pct",
      "L2_bonus_total",
    ]);

    // appliesに必要列保証（壊さない）
    let values = getValuesSafe_(applies);
    let header = values[0];

    ensureCols_(applies, header, [
      "created_at",
      "email",
      "status",
      "login_id",
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ref_path",
      "expected_paid",
      "plan",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    values = getValuesSafe_(applies);
    header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    // maps
    const byLogin = {};
    const children = {};

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const loginId = str_(r[idx["login_id"]]);
      if (!loginId) continue;

      byLogin[loginId] = {
        login_id: loginId,
        email: str_(r[idx["email"]]),
        status: str_(r[idx["status"]]),
        created_at: r[idx["created_at"]],
        ref1: str_(r[idx["referrer_login_id"]]),
        share_pct: parseMoneyLike_(r[idx["ref_share_pct"]]),
      };
    }

    for (const k in byLogin) {
      children[k] = [];
    }

    for (const k2 in byLogin) {
      const node = byLogin[k2];
      const p = str_(node.ref1);
      if (p && children[p]) {
        children[p].push(node.login_id);
      }
    }

    // direct count
    const directCount = {};
    for (const k3 in children) {
      directCount[k3] = (children[k3] || []).length;
    }

    // ✅ 紹介配当の合計を集計（表示用）
    // - 1段のみ：child の referrer_login_id に対して referrer の ref_share_pct を適用
    // - 金額基準：plan額（expected_paid）で計算
    const bonusTotalByLogin = {};
    for (const kx in byLogin) bonusTotalByLogin[kx] = 0;

    for (let ii = 0; ii < rows.length; ii++) {
      const r = rows[ii];

      const childStatus = str_(r[idx["status"]]);
      const childRef1 = str_(r[idx["referrer_login_id"]]);
      if (!childRef1) continue;

      // approved（or paid）以外は対象外（表示上の事故を防ぐ）
      if (childStatus !== "approved" && childStatus !== "paid") continue;

      // expected_paid が空なら plan から埋める（表示用途：壊さない）
      let expected = parseMoneyLike_(r[idx["expected_paid"]]);
      if (!expected || !Number.isFinite(expected) || expected <= 0) {
        const p2 = str_(r[idx["plan"]]);
        const exp2 = planToExpectedPaid_(p2);
        if (exp2 > 0) expected = exp2;
      }
      if (!expected || !Number.isFinite(expected) || expected <= 0) continue;

      const refNode = byLogin[childRef1];
      if (!refNode) continue;

      const pct = Number.isFinite(refNode.share_pct) ? refNode.share_pct : 0;
      const pctOk = pct === 20 || pct === 40;
      if (!pctOk) continue;

      const bonus = expected * (pct / 100);
      if (!bonusTotalByLogin[childRef1]) bonusTotalByLogin[childRef1] = 0;
      bonusTotalByLogin[childRef1] += bonus;
    }

    // L1 roots = 直紹介が1人以上いる人
    const l1s = Object.keys(children).filter((k4) => (children[k4] || []).length > 0);

    // 並び順：直紹介が多い順→login_id
    l1s.sort((a, b) => {
      const da = directCount[a] || 0;
      const db = directCount[b] || 0;
      if (db !== da) return db - da;
      return a < b ? -1 : a > b ? 1 : 0;
    });

    // rows out
    const out = [];

    function label_(loginId, prefix) {
      const email = byLogin[loginId] ? byLogin[loginId].email : "";
      const base = loginId + (email ? " (" + email + ")" : "");
      return (prefix || "") + base;
    }

    function pct_(loginId) {
      const n = byLogin[loginId] ? Number(byLogin[loginId].share_pct || 0) : 0;
      if (n === 20 || n === 40) return n;
      return "";
    }

    function bonus_(loginId) {
      const n = bonusTotalByLogin[loginId] ? Number(bonusTotalByLogin[loginId] || 0) : 0;
      if (!Number.isFinite(n) || n <= 0) return 0;
      return n;
    }

    for (let i1 = 0; i1 < l1s.length; i1++) {
      const l1 = l1s[i1];
      const l1Kids = children[l1] || [];

      // L2並び：直紹介が多い順→login_id
      l1Kids.sort((a, b) => {
        const da = directCount[a] || 0;
        const db = directCount[b] || 0;
        if (db !== da) return db - da;
        return a < b ? -1 : a > b ? 1 : 0;
      });

      for (let i2 = 0; i2 < l1Kids.length; i2++) {
        const l2 = l1Kids[i2];
        const l2Kids = children[l2] || [];

        // L3並び：login_id
        l2Kids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

        if (l2Kids.length === 0) {
          // 3段目がいない場合も行を出す（ツリーに見える）
          out.push([
            label_(l1, ""),
            directCount[l1] || 0,
            label_(l2, "  └ "),
            directCount[l2] || 0,
            "",
            "",
            "",
            "",
            pct_(l1),
            bonus_(l1),
            pct_(l2),
            bonus_(l2),
          ]);
        } else {
          for (let i3 = 0; i3 < l2Kids.length; i3++) {
            const l3 = l2Kids[i3];
            const node3 = byLogin[l3] || {};
            out.push([
              label_(l1, ""),
              directCount[l1] || 0,
              label_(l2, "  └ "),
              directCount[l2] || 0,
              label_(l3, "      └ "),
              str_(node3.status),
              str_(node3.email),
              node3.created_at || "",
              pct_(l1),
              bonus_(l1),
              pct_(l2),
              bonus_(l2),
            ]);
          }
        }
      }

      // L1ごとに空行（見た目がツリーになる）
      out.push(["", "", "", "", "", "", "", "", "", "", "", ""]);
    }

    // ✅ out が作れた後に ref_tree を全消し→再生成（途中エラーで空になるのを防ぐ）
    try {
      const lr = treeSheet.getLastRow();
      const lc = treeSheet.getLastColumn();
      if (lr && lc) {
        treeSheet.getRange(1, 1, lr, lc).clearContent();
      } else {
        treeSheet.clearContents();
      }
    } catch (e) {
      treeSheet.clearContents();
    }

    treeSheet.appendRow([
      "L1",
      "L1_direct_count",
      "L2",
      "L2_direct_count",
      "L3",
      "L3_status",
      "L3_email",
      "L3_created_at",
      "L1_share_pct",
      "L1_bonus_total",
      "L2_share_pct",
      "L2_bonus_total",
    ]);

    // 書き込み（まとめて）※大きい場合に備えて分割（保険）
    if (out.length > 0) {
      const CHUNK = 5000;
      for (let i = 0; i < out.length; i += CHUNK) {
        const part = out.slice(i, i + CHUNK);
        treeSheet.getRange(2 + i, 1, part.length, 12).setValues(part);
      }
    }

    // 見やすく：フィルタと列幅（壊さない）
    try {
      treeSheet.setFrozenRows(1);
      treeSheet.autoResizeColumns(1, 12);
    } catch (e) {}

    return json_({ ok: true, l1_count: l1s.length, rows: out.length });
  }

  // =========================================================
  // ✅ send_test_mail（管理：メール送信テスト）
  // adminKey + to アドレスが必要。デプロイ後のMailApp動作確認用。
  // curl などから: ?action=send_test_mail&key=...&adminKey=...&to=xxx@yyy.com
  // =========================================================
  if (action === "send_test_mail") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }
    const to = str_(body.to);
    if (!to) {
      return json_({ ok: false, error: "to required" });
    }
    try {
      const quota = MailApp.getRemainingDailyQuota();
      Logger.log("[send_test_mail] quota=" + quota + " to=" + to);
      if (quota <= 0) {
        return json_({ ok: false, error: "quota_exhausted", quota: quota });
      }
      sendResetMail_(to, "TEST_LOGIN_ID", "TEST_TOKEN_" + Date.now());
      return json_({ ok: true, to: to, quota: quota });
    } catch (e) {
      Logger.log("[send_test_mail] FAILED: " + String(e));
      return json_({ ok: false, error: String(e) });
    }
  }

  // =========================================================
  // ✅ get_balance（BP/EP残高取得）
  // - Nextの /api/wallet/balance から叩かれる想定
  // - id は login_id か email を許容（壊さない）
  // - 列は ensureCols_ で保証（壊さない）
  // =========================================================
  if (action === "get_balance") {
    const id = str_(body.id);

    if (!id) {
      return json_({ ok: false, error: "id required" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, ["login_id", "email", "bp_balance", "ep_balance"]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hit = null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = i + 2;

      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);

      if (id === loginId || id === email) {
        hit = { r: r, rowIndex: rowIndex };
        break;
      }
    }

    if (!hit) {
      return json_({ ok: false, error: "not_found" });
    }

    const bpRaw = hit.r[idx["bp_balance"]];
    const epRaw = hit.r[idx["ep_balance"]];

    const bp = Number(bpRaw || 0);
    const ep = Number(epRaw || 0);

    return json_({
      ok: true,
      bp: Number.isFinite(bp) ? bp : 0,
      ep: Number.isFinite(ep) ? ep : 0,
    });
  }

  // =========================================================
  // deduct_bp（BP減算：AI機能利用時に呼ぶ）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - loginId でユーザーを特定し bp_balance を減算
  // - wallet_ledger に記録
  // =========================================================
  if (action === "deduct_bp") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const amount  = Number(body.amount);

    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (!Number.isFinite(amount) || amount <= 0) return json_({ ok: false, error: "invalid_amount" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, ["login_id", "email", "bp_balance"]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const currentBp = Number(sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).getValue() || 0);

    if (currentBp < amount) {
      return json_({ ok: false, error: "insufficient_bp", bp_balance: currentBp });
    }

    const newBp = currentBp - amount;
    sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).setValue(newBp);

    appendWalletLedger_({
      kind:     "deduct_bp",
      login_id: loginId,
      email:    hitEmail,
      amount:   -amount,
      memo:     "AI機能利用によるBP消費",
    });

    return json_({ ok: true, bp_balance: newBp });
  }

  // =========================================================
  // daily_login_bonus（ログインボーナス付与：1日1回）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - 連続ログイン日数に応じてBPを付与
  // - 1日30BP上限クリップ
  // =========================================================
  if (action === "daily_login_bonus") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "login_id", "email", "bp_balance",
      "last_login_at", "login_streak",
      "daily_bp_earned", "daily_ep_earned", "daily_reset_date",
      "total_login_count",
      "mission_login_date", "mission_fortune_date",
      "mission_music_date", "mission_bonus_date",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    // JST の今日の日付（YYYY-MM-DD）
    const nowJst  = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10); // "YYYY-MM-DD"

    const lastLoginRaw  = sheet.getRange(hitRowIndex, idx["last_login_at"]    + 1).getValue();
    const streakRaw     = sheet.getRange(hitRowIndex, idx["login_streak"]      + 1).getValue();
    const dailyBpRaw    = sheet.getRange(hitRowIndex, idx["daily_bp_earned"]   + 1).getValue();
    const dailyResetRaw = sheet.getRange(hitRowIndex, idx["daily_reset_date"]  + 1).getValue();
    const loginCountRaw = sheet.getRange(hitRowIndex, idx["total_login_count"] + 1).getValue();
    const bpRaw         = sheet.getRange(hitRowIndex, idx["bp_balance"]        + 1).getValue();

    // 今日既に実行済みか判定
    const lastLoginDate = lastLoginRaw ? new Date(lastLoginRaw) : null;
    const lastLoginStr  = lastLoginDate
      ? new Date(lastLoginDate.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : "";

    if (lastLoginStr === todayStr) {
      return json_({ ok: false, reason: "already_claimed" });
    }

    // 日次集計リセット（daily_reset_date が今日でなければリセット）
    const dailyResetStr = str_(dailyResetRaw);
    let dailyBpEarned   = dailyResetStr === todayStr ? Number(dailyBpRaw || 0) : 0;

    // 連続ログイン日数計算
    const yesterdayJst = new Date(nowJst.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayJst.toISOString().slice(0, 10);
    let streak = lastLoginStr === yesterdayStr ? Number(streakRaw || 0) + 1 : 1;

    // streakに応じてボーナスBP決定
    let bonusBp;
    if      (streak >= 30) bonusBp = 100;
    else if (streak >= 7)  bonusBp = 20;
    else if (streak >= 3)  bonusBp = 10;
    else                   bonusBp = 5;

    // 1日30BP上限クリップ
    const BP_DAY_MAX = 30;
    const remaining  = BP_DAY_MAX - dailyBpEarned;
    const bpEarned   = remaining > 0 ? Math.min(bonusBp, remaining) : 0;

    const currentBp = Number(bpRaw || 0);
    const newBp     = currentBp + bpEarned;
    const newCount  = Number(loginCountRaw || 0) + 1;
    dailyBpEarned  += bpEarned;

    // シート書き込み
    sheet.getRange(hitRowIndex, idx["bp_balance"]        + 1).setValue(newBp);
    sheet.getRange(hitRowIndex, idx["last_login_at"]     + 1).setValue(new Date());
    sheet.getRange(hitRowIndex, idx["login_streak"]      + 1).setValue(streak);
    sheet.getRange(hitRowIndex, idx["daily_bp_earned"]   + 1).setValue(dailyBpEarned);
    sheet.getRange(hitRowIndex, idx["daily_reset_date"]  + 1).setValue(todayStr);
    sheet.getRange(hitRowIndex, idx["total_login_count"] + 1).setValue(newCount);

    if (bpEarned > 0) {
      appendWalletLedger_({
        kind:     "login_bonus",
        login_id: loginId,
        email:    hitEmail,
        amount:   bpEarned,
        memo:     "ログインボーナス（streak=" + streak + "）",
      });
    }

    return json_({ ok: true, bp_earned: bpEarned, streak: streak, bp_balance: newBp });
  }

  // =========================================================
  // get_missions（今日のミッション状況取得）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - loginId でユーザーを検索し、ミッション列と bp_balance を返す
  // =========================================================
  if (action === "get_missions") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, [
      "login_id", "email", "bp_balance",
      "mission_login_date", "mission_fortune_date",
      "mission_music_date", "mission_bonus_date",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitRow      = null;

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitRow      = rows[i];
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    const mLoginDate   = str_(hitRow[idx["mission_login_date"]]);
    const mFortuneDate = str_(hitRow[idx["mission_fortune_date"]]);
    const mMusicDate   = str_(hitRow[idx["mission_music_date"]]);
    const mBonusDate   = str_(hitRow[idx["mission_bonus_date"]]);
    const bpBalance    = Number(hitRow[idx["bp_balance"]] || 0);

    return json_({
      ok:    true,
      today: todayStr,
      missions: {
        login:   { done: mLoginDate   === todayStr, reward: 5  },
        fortune: { done: mFortuneDate === todayStr, reward: 10 },
        music:   { done: mMusicDate   === todayStr, reward: 15 },
      },
      all_complete_bonus: { done: mBonusDate === todayStr, reward: 20 },
      bp_balance: bpBalance,
    });
  }

  // =========================================================
  // complete_mission（ミッション完了 → BP付与）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - mission_type: "login" | "fortune" | "music"
  // - 1日1回制限（日付カラムで判定）
  // - 3ミッション全完了時に +20BP ボーナス自動付与
  // =========================================================
  if (action === "complete_mission") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId     = str_(body.loginId);
    const missionType = str_(body.mission_type);

    if (!loginId)     return json_({ ok: false, error: "loginId_required" });
    if (!missionType) return json_({ ok: false, error: "mission_type_required" });

    const MISSION_COL_MAP = {
      login:   "mission_login_date",
      fortune: "mission_fortune_date",
      music:   "mission_music_date",
    };
    const MISSION_REWARD_MAP = { login: 5, fortune: 10, music: 15 };

    if (!MISSION_COL_MAP[missionType]) {
      return json_({ ok: false, error: "invalid_mission_type" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, [
      "login_id", "email", "bp_balance",
      "mission_login_date", "mission_fortune_date",
      "mission_music_date", "mission_bonus_date",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitRow      = null;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitRow      = rows[i];
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    const missionColKey = MISSION_COL_MAP[missionType];
    const existingDate  = str_(hitRow[idx[missionColKey]]);

    if (existingDate === todayStr) {
      return json_({ ok: false, reason: "already_done" });
    }

    const reward     = MISSION_REWARD_MAP[missionType];
    const currentBp  = Number(hitRow[idx["bp_balance"]] || 0);
    const newBp      = currentBp + reward;

    sheet.getRange(hitRowIndex, idx[missionColKey] + 1).setValue(todayStr);
    sheet.getRange(hitRowIndex, idx["bp_balance"]  + 1).setValue(newBp);

    appendWalletLedger_({
      kind:     "mission_" + missionType,
      login_id: loginId,
      email:    hitEmail,
      amount:   reward,
      memo:     "ミッション達成（" + missionType + "）",
    });

    // 全ミッション完了チェック → ボーナス付与
    const loginDone   = missionType === "login"   ? todayStr : str_(hitRow[idx["mission_login_date"]]);
    const fortuneDone = missionType === "fortune" ? todayStr : str_(hitRow[idx["mission_fortune_date"]]);
    const musicDone   = missionType === "music"   ? todayStr : str_(hitRow[idx["mission_music_date"]]);
    const bonusDate   = str_(hitRow[idx["mission_bonus_date"]]);

    let allCompleteBonusGiven = false;
    let finalBp = newBp;

    if (
      loginDone   === todayStr &&
      fortuneDone === todayStr &&
      musicDone   === todayStr &&
      bonusDate   !== todayStr
    ) {
      const BONUS_REWARD = 20;
      finalBp = newBp + BONUS_REWARD;
      sheet.getRange(hitRowIndex, idx["bp_balance"]      + 1).setValue(finalBp);
      sheet.getRange(hitRowIndex, idx["mission_bonus_date"] + 1).setValue(todayStr);
      appendWalletLedger_({
        kind:     "mission_all_complete",
        login_id: loginId,
        email:    hitEmail,
        amount:   BONUS_REWARD,
        memo:     "全ミッション完了ボーナス",
      });
      allCompleteBonusGiven = true;
    }

    return json_({
      ok:                  true,
      bp_earned:           reward + (allCompleteBonusGiven ? 20 : 0),
      all_complete_bonus:  allCompleteBonusGiven,
      bp_balance:          finalBp,
    });
  }

  // =========================================================
  // fortune_daily_bp（毎日の占い閲覧 → BP付与）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - mission_fortune_date が今日なら already_claimed を返す
  // - 付与額: +10 BP
  // =========================================================
  if (action === "fortune_daily_bp") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, [
      "login_id", "email", "bp_balance", "mission_fortune_date",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitRow      = null;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitRow      = rows[i];
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    const existingDate = str_(hitRow[idx["mission_fortune_date"]]);
    if (existingDate === todayStr) {
      return json_({ ok: false, reason: "already_claimed" });
    }

    const BP_REWARD = 10;
    const currentBp = Number(hitRow[idx["bp_balance"]] || 0);
    const newBp     = currentBp + BP_REWARD;

    sheet.getRange(hitRowIndex, idx["mission_fortune_date"] + 1).setValue(todayStr);
    sheet.getRange(hitRowIndex, idx["bp_balance"]           + 1).setValue(newBp);

    appendWalletLedger_({
      kind:     "fortune_daily",
      login_id: loginId,
      email:    hitEmail,
      amount:   BP_REWARD,
      memo:     "毎日の占いBP",
    });

    return json_({ ok: true, bp_earned: BP_REWARD, bp_balance: newBp });
  }

  // =========================================================
  // gacha_spin（BPガチャ：100BP消費 → 重み付き抽選でBP付与）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - bp_balance < 100 なら insufficient_bp を返す
  // - wallet_ledger に gacha_cost / gacha_prize の2件記録
  // =========================================================
  if (action === "gacha_spin") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    ensureCols_(sheet, header, ["login_id", "email", "bp_balance"]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const GACHA_COST = 100;
    const currentBp  = Number(sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).getValue() || 0);

    if (currentBp < GACHA_COST) {
      return json_({ ok: false, reason: "insufficient_bp", bp_balance: currentBp });
    }

    // 重み付き抽選（合計weight=100）
    const prizes  = [50, 100, 200, 500, 1000, 5000];
    const weights = [40, 30, 15, 10, 4, 1];
    const rand    = Math.random() * 100;
    let cumulative = 0;
    let prizeBp    = prizes[0];
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) {
        prizeBp = prizes[i];
        break;
      }
    }

    const afterCost = currentBp - GACHA_COST;
    const newBp     = afterCost + prizeBp;

    sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).setValue(newBp);

    appendWalletLedger_({
      kind:     "gacha_cost",
      login_id: loginId,
      email:    hitEmail,
      amount:   -GACHA_COST,
      memo:     "BPガチャ消費",
    });

    appendWalletLedger_({
      kind:     "gacha_prize",
      login_id: loginId,
      email:    hitEmail,
      amount:   prizeBp,
      memo:     "BPガチャ当選（" + prizeBp + "BP）",
    });

    return json_({
      ok:         true,
      cost:       GACHA_COST,
      prize_bp:   prizeBp,
      bp_balance: newBp,
      net:        prizeBp - GACHA_COST,
    });
  }

  // =========================================================
  // get_radio_songs（ラジオ楽曲一覧取得：active=trueのみ返す）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "get_radio_songs") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const songsSheet = getOrCreateRadioSongsSheet_();
    const sValues    = songsSheet.getDataRange().getValues();
    const sHeader    = sValues[0];
    const sIdx       = indexMap_(sHeader);
    const sRows      = sValues.slice(1);

    const songs = [];
    for (let i = 0; i < sRows.length; i++) {
      const row = sRows[i];
      const activeVal = row[sIdx["active"]];
      if (activeVal !== true && str_(activeVal) !== "TRUE" && str_(activeVal) !== "true" && str_(activeVal) !== "1") continue;
      let serviceLinks = {};
      try { serviceLinks = JSON.parse(str_(row[sIdx["service_links"]]) || "{}"); } catch (e) {}
      songs.push({
        song_id:       str_(row[sIdx["song_id"]]),
        title:         str_(row[sIdx["title"]]),
        artist:        str_(row[sIdx["artist"]]),
        service_links: serviceLinks,
        thumbnail_url: str_(row[sIdx["thumbnail_url"]]),
      });
    }

    return json_({ ok: true, songs: songs });
  }

  // =========================================================
  // get_radio_status（今日のラジオミッション状況取得）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "get_radio_status") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    // applies からサブスクプランを取得
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "subscription_plan"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);
    let subPlan = "free";
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        const p = str_(rows[i][idx["subscription_plan"]]);
        if (p) subPlan = p;
        break;
      }
    }

    const PLAN_LIMITS = { free: 1, plus: 3, pro: 5, priority: 5, partner: 5 };
    const dailyLimit = PLAN_LIMITS[subPlan] || 1;

    // radio_missions から今日の集計
    const missionsSheet = getOrCreateRadioMissionsSheet_();
    const mValues = missionsSheet.getDataRange().getValues();
    const mHeader = mValues[0];
    const mIdx    = indexMap_(mHeader);
    const mRows   = mValues.slice(1);

    let todayCount    = 0;
    let startedMission = null;

    for (let i = 0; i < mRows.length; i++) {
      const row = mRows[i];
      if (str_(row[mIdx["login_id"]]) !== loginId) continue;
      const status = str_(row[mIdx["status"]]);

      // submitted/approved を今日の達成件数としてカウント
      const submittedAt = row[mIdx["submitted_at"]];
      if (submittedAt && (status === "submitted" || status === "approved")) {
        const submittedStr = new Date(new Date(submittedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (submittedStr === todayStr) todayCount++;
      }

      // started かつ未提出のミッション
      if (status === "started") {
        const startedAt = row[mIdx["started_at"]];
        const startedStr = startedAt
          ? new Date(new Date(startedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : "";
        if (startedStr === todayStr) {
          startedMission = {
            mission_id: str_(row[mIdx["mission_id"]]),
            song_id:    str_(row[mIdx["song_id"]]),
            started_at: startedAt ? new Date(startedAt).toISOString() : "",
          };
        }
      }
    }

    return json_({
      ok:              true,
      today_count:     todayCount,
      daily_limit:     dailyLimit,
      remaining:       Math.max(0, dailyLimit - todayCount),
      started_mission: startedMission,
    });
  }

  // =========================================================
  // radio_start（ラジオ視聴開始）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "radio_start") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const songId  = str_(body.song_id);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (!songId)  return json_({ ok: false, error: "song_id_required" });

    const nowJst   = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowJst.toISOString().slice(0, 10);

    // applies からサブスクプランを取得
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "subscription_plan"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);
    let subPlan = "free";
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        const p = str_(rows[i][idx["subscription_plan"]]);
        if (p) subPlan = p;
        break;
      }
    }

    const PLAN_LIMITS = { free: 1, plus: 3, pro: 5, priority: 5, partner: 5 };
    const dailyLimit = PLAN_LIMITS[subPlan] || 1;

    // radio_missions から今日の集計
    const missionsSheet = getOrCreateRadioMissionsSheet_();
    const mValues = missionsSheet.getDataRange().getValues();
    const mHeader = mValues[0];
    const mIdx    = indexMap_(mHeader);
    const mRows   = mValues.slice(1);

    let todayDoneCount = 0;
    for (let i = 0; i < mRows.length; i++) {
      const row    = mRows[i];
      if (str_(row[mIdx["login_id"]]) !== loginId) continue;
      const status = str_(row[mIdx["status"]]);
      if (status === "submitted" || status === "approved") {
        const submittedAt = row[mIdx["submitted_at"]];
        if (submittedAt) {
          const submittedStr = new Date(new Date(submittedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
          if (submittedStr === todayStr) todayDoneCount++;
        }
      }
      // 同じ song_id で today started かつ未提出
      if (status === "started" && str_(row[mIdx["song_id"]]) === songId) {
        const startedAt  = row[mIdx["started_at"]];
        const startedStr = startedAt
          ? new Date(new Date(startedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : "";
        if (startedStr === todayStr) return json_({ ok: false, reason: "already_started" });
      }
    }

    if (todayDoneCount >= dailyLimit) return json_({ ok: false, reason: "daily_limit" });

    const missionId = "rdm_" + Utilities.getUuid().slice(0, 8);
    missionsSheet.appendRow([
      missionId,
      loginId,
      songId,
      nowJst,
      "",
      "started",
      "",
      "",
    ]);

    return json_({ ok: true, mission_id: missionId, started_at: nowJst.toISOString() });
  }

  // =========================================================
  // radio_submit（ラジオ視聴完了申請 → v1はオート承認・EP付与）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "radio_submit") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId        = str_(body.loginId);
    const missionId      = str_(body.mission_id);
    const screenshotNote = str_(body.screenshot_note);
    if (!loginId)   return json_({ ok: false, error: "loginId_required" });
    if (!missionId) return json_({ ok: false, error: "mission_id_required" });

    // radio_missions から mission_id で行を検索
    const missionsSheet = getOrCreateRadioMissionsSheet_();
    const mValues = missionsSheet.getDataRange().getValues();
    const mHeader = mValues[0];
    const mIdx    = indexMap_(mHeader);
    const mRows   = mValues.slice(1);

    let mHitRowIndex = 0;
    let mHitRow      = null;
    for (let i = 0; i < mRows.length; i++) {
      if (str_(mRows[i][mIdx["mission_id"]]) === missionId) {
        mHitRowIndex = i + 2;
        mHitRow      = mRows[i];
        break;
      }
    }
    if (!mHitRowIndex)                                     return json_({ ok: false, reason: "not_found" });
    if (str_(mHitRow[mIdx["login_id"]]) !== loginId)      return json_({ ok: false, reason: "not_found" });
    if (str_(mHitRow[mIdx["status"]]) !== "started")      return json_({ ok: false, reason: "invalid_status" });

    const nowJst      = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const RADIO_EP    = 5;

    // submitted_at / screenshot_note / status → submitted
    missionsSheet.getRange(mHitRowIndex, mIdx["submitted_at"]    + 1).setValue(nowJst);
    missionsSheet.getRange(mHitRowIndex, mIdx["screenshot_note"] + 1).setValue(screenshotNote);
    missionsSheet.getRange(mHitRowIndex, mIdx["status"]          + 1).setValue("submitted");

    // v1 オート承認: EP付与
    // applies から ep_balance を更新
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "email", "ep_balance"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";
    let currentEp   = 0;
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        currentEp   = Number(rows[i][idx["ep_balance"]] || 0);
        break;
      }
    }

    let newEp = currentEp;
    if (hitRowIndex) {
      newEp = currentEp + RADIO_EP;
      sheet.getRange(hitRowIndex, idx["ep_balance"] + 1).setValue(newEp);
    }

    // ep_granted / status → approved
    missionsSheet.getRange(mHitRowIndex, mIdx["ep_granted"] + 1).setValue(RADIO_EP);
    missionsSheet.getRange(mHitRowIndex, mIdx["status"]     + 1).setValue("approved");

    appendWalletLedger_({
      kind:     "radio_ep",
      login_id: loginId,
      email:    hitEmail,
      amount:   RADIO_EP,
      memo:     "LIFAI RADIO視聴EP（mission_id=" + missionId + "）",
    });

    return json_({ ok: true, ep_granted: RADIO_EP, ep_balance: newEp });
  }

  // =========================================================
  // stake_bp（BPステーキング開始：BPを預けて満期後に利息付きで受け取る）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - 最低100BP / days: 30 | 60 | 90
  // =========================================================
  if (action === "stake_bp") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const amount  = Number(body.amount);
    const days    = Number(body.days);

    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (amount < 100) return json_({ ok: false, reason: "min_100" });

    const RATE_MAP = { 30: 0.10, 60: 0.25, 90: 0.50 };
    if (!RATE_MAP[days]) return json_({ ok: false, reason: "invalid_days" });

    // applies シートからユーザー検索
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "email", "bp_balance"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        break;
      }
    }
    if (!hitRowIndex) return json_({ ok: false, error: "not_found" });

    const currentBp = Number(sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).getValue() || 0);
    if (currentBp < amount) {
      return json_({ ok: false, reason: "insufficient_bp", bp_balance: currentBp });
    }

    const rate       = RATE_MAP[days];
    const interestBp = Math.floor(amount * rate);
    const totalBp    = amount + interestBp;

    const nowJst     = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const expiresJst = new Date(nowJst.getTime() + days * 24 * 60 * 60 * 1000);
    const stakeId    = "stk_" + Utilities.getUuid().slice(0, 8);

    // BPを引く
    const newBp = currentBp - amount;
    sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).setValue(newBp);

    // staking シートに追記
    const stakingSheet = getOrCreateStakingSheet_();
    stakingSheet.appendRow([
      stakeId,
      loginId,
      amount,
      rate,
      nowJst,
      expiresJst,
      "active",
      "",
      interestBp,
      totalBp,
    ]);

    appendWalletLedger_({
      kind:     "stake_lock",
      login_id: loginId,
      email:    hitEmail,
      amount:   -amount,
      memo:     "BPステーキング預入（" + days + "日 " + (rate * 100) + "%）",
    });

    return json_({
      ok:         true,
      stake_id:   stakeId,
      staked_bp:  amount,
      interest_bp: interestBp,
      total_bp:   totalBp,
      expires_at: expiresJst.toISOString(),
      bp_balance: newBp,
    });
  }

  // =========================================================
  // get_stakes（ステーク一覧取得）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // - loginId のステーク行を全件返す（claimable フラグ付き）
  // =========================================================
  if (action === "get_stakes") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });

    // applies から bp_balance 取得
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "bp_balance"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);
    let bpBalance = 0;
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        bpBalance = Number(rows[i][idx["bp_balance"]] || 0);
        break;
      }
    }

    // staking シートから該当行を取得
    const stakingSheet = getOrCreateStakingSheet_();
    const sValues = stakingSheet.getDataRange().getValues();
    const sHeader = sValues[0];
    const sIdx    = indexMap_(sHeader);
    const sRows   = sValues.slice(1);

    const nowMs = Date.now();
    const stakes = [];
    for (let i = 0; i < sRows.length; i++) {
      const row = sRows[i];
      if (str_(row[sIdx["login_id"]]) !== loginId) continue;
      const expiresAt = row[sIdx["expires_at"]];
      const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
      const status    = str_(row[sIdx["status"]]);
      const claimable = status === "active" && nowMs > expiresMs;
      stakes.push({
        stake_id:    str_(row[sIdx["stake_id"]]),
        staked_bp:   Number(row[sIdx["staked_bp"]] || 0),
        rate:        Number(row[sIdx["rate"]] || 0),
        interest_bp: Number(row[sIdx["interest_bp"]] || 0),
        total_bp:    Number(row[sIdx["total_bp"]] || 0),
        started_at:  row[sIdx["started_at"]] ? new Date(row[sIdx["started_at"]]).toISOString() : "",
        expires_at:  expiresAt ? new Date(expiresAt).toISOString() : "",
        status:      status,
        claimed_at:  row[sIdx["claimed_at"]] ? new Date(row[sIdx["claimed_at"]]).toISOString() : "",
        claimable:   claimable,
      });
    }

    return json_({ ok: true, stakes: stakes, bp_balance: bpBalance });
  }

  // =========================================================
  // claim_stake（ステーク受け取り：満期を迎えたステークを受け取る）
  // - adminKey 認証必須（GAS_ADMIN_KEY）
  // =========================================================
  if (action === "claim_stake") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const loginId = str_(body.loginId);
    const stakeId = str_(body.stake_id);
    if (!loginId) return json_({ ok: false, error: "loginId_required" });
    if (!stakeId) return json_({ ok: false, error: "stake_id_required" });

    // staking シートから stake_id で行を検索
    const stakingSheet = getOrCreateStakingSheet_();
    const sValues = stakingSheet.getDataRange().getValues();
    const sHeader = sValues[0];
    const sIdx    = indexMap_(sHeader);
    const sRows   = sValues.slice(1);

    let sHitRowIndex = 0;
    let sHitRow      = null;
    for (let i = 0; i < sRows.length; i++) {
      if (str_(sRows[i][sIdx["stake_id"]]) === stakeId) {
        sHitRowIndex = i + 2;
        sHitRow      = sRows[i];
        break;
      }
    }
    if (!sHitRowIndex) return json_({ ok: false, reason: "not_found" });
    if (str_(sHitRow[sIdx["login_id"]]) !== loginId) return json_({ ok: false, reason: "not_found" });
    if (str_(sHitRow[sIdx["status"]]) !== "active") return json_({ ok: false, reason: "already_claimed" });

    const expiresAt = sHitRow[sIdx["expires_at"]];
    const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (Date.now() <= expiresMs) return json_({ ok: false, reason: "not_matured" });

    const totalBp = Number(sHitRow[sIdx["total_bp"]] || 0);

    // applies シートから bp_balance 取得・更新
    let values = sheet.getDataRange().getValues();
    let header = values[0];
    ensureCols_(sheet, header, ["login_id", "email", "bp_balance"]);
    values = sheet.getDataRange().getValues();
    header = values[0];
    const idx  = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;
    let hitEmail    = "";
    let currentBp   = 0;
    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        hitRowIndex = i + 2;
        hitEmail    = str_(rows[i][idx["email"]]);
        currentBp   = Number(rows[i][idx["bp_balance"]] || 0);
        break;
      }
    }
    if (!hitRowIndex) return json_({ ok: false, error: "user_not_found" });

    const newBp = currentBp + totalBp;
    sheet.getRange(hitRowIndex, idx["bp_balance"] + 1).setValue(newBp);

    // staking シートを更新
    const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    stakingSheet.getRange(sHitRowIndex, sIdx["status"]     + 1).setValue("claimed");
    stakingSheet.getRange(sHitRowIndex, sIdx["claimed_at"] + 1).setValue(nowJst);

    appendWalletLedger_({
      kind:     "stake_claim",
      login_id: loginId,
      email:    hitEmail,
      amount:   totalBp,
      memo:     "BPステーキング受取（stake_id=" + stakeId + "）",
    });

    return json_({ ok: true, total_bp: totalBp, bp_balance: newBp });
  }

  // =========================================================
  // reset_password（token検証 → 新PW hash更新 → token無効化）
  // =========================================================
  if (action === "reset_password") {
    const token = str_(body.token);
    const password = str_(body.password);

    if (!token || !password) {
      return json_({ ok: false, error: "missing_fields" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;

    for (let i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["reset_token"]]) === token) {
        hitRowIndex = i + 2;
        break;
      }
    }

    if (!hitRowIndex) return json_({ ok: false, error: "invalid_token" });

    // 期限チェック（追加：安全）
    const exp = sheet.getRange(hitRowIndex, idx["reset_expires"] + 1).getValue();
    if (exp && new Date(exp).getTime && new Date(exp).getTime() < Date.now()) {
      return json_({ ok: false, error: "token_expired" });
    }

    // 使用済みチェック（追加：安全）
    const used = sheet.getRange(hitRowIndex, idx["reset_used_at"] + 1).getValue();
    if (used) {
      return json_({ ok: false, error: "token_used" });
    }

    const loginId = str_(sheet.getRange(hitRowIndex, idx["login_id"] + 1).getValue());
    if (!loginId) return json_({ ok: false, error: "missing_login_id" });

    const hash = hmacSha256Hex_(SECRET, loginId + ":" + password);

    sheet.getRange(hitRowIndex, idx["pw_hash"] + 1).setValue(hash);
    sheet.getRange(hitRowIndex, idx["pw_updated_at"] + 1).setValue(new Date());
    sheet.getRange(hitRowIndex, idx["reset_used_at"] + 1).setValue(new Date());
    sheet.getRange(hitRowIndex, idx["reset_token"] + 1).setValue("");

    return json_({ ok: true });
  }

  // =========================================================
  // ✅ reset_resend（管理：初回パスワード設定メールの再送）
  // - 期限切れ/見逃し対応のための再送アクション（壊さない）
  // - adminKey 必須（安全）
  // - id は login_id or email を許容（壊さない）
  // - status が approved の人のみ再送（安全）
  // - reset_token/reset_expires を再発行し、reset_used_at を空にし、reset_sent_at を更新して送信
  // =========================================================
  if (action === "reset_resend") {
    if (str_(body.adminKey) !== ADMIN_SECRET) {
      return json_({ ok: false, error: "admin_unauthorized" });
    }

    const id = str_(body.id);
    const emailIn = str_(body.email);

    if (!id && !emailIn) {
      return json_({ ok: false, error: "missing_id_or_email" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "email",
      "status",
      "login_id",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hitRowIndex = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = i + 2;

      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);

      if ((id && (id === loginId || id === email)) || (emailIn && emailIn === email)) {
        hitRowIndex = rowIndex;
        break;
      }
    }

    if (!hitRowIndex) {
      return json_({ ok: false, error: "not_found" });
    }

    const status = str_(sheet.getRange(hitRowIndex, idx["status"] + 1).getValue());
    if (status !== "approved") {
      return json_({ ok: false, error: "not_approved" });
    }

    const loginId2 = str_(sheet.getRange(hitRowIndex, idx["login_id"] + 1).getValue());
    const email2 = str_(sheet.getRange(hitRowIndex, idx["email"] + 1).getValue());

    if (!loginId2 || !email2) {
      return json_({ ok: false, error: "missing_login_or_email" });
    }

    // RESET TOKEN再発行（30分）
    const token = genResetToken_();
    const expires = new Date(Date.now() + 72 * 60 * 60 * 1000);

    sheet.getRange(hitRowIndex, idx["reset_token"] + 1).setValue(token);
    sheet.getRange(hitRowIndex, idx["reset_expires"] + 1).setValue(expires);
    sheet.getRange(hitRowIndex, idx["reset_used_at"] + 1).setValue("");

    sendResetMail_(email2, loginId2, token);
    sheet.getRange(hitRowIndex, idx["reset_sent_at"] + 1).setValue(new Date());

    return json_({ ok: true });
  }

  // =========================================================
  // me（ログイン情報 + 紹介コード情報を返す）
  // - Nextの /api/me から 叩く用の中継API対応
  // - login と同じ認証（approvedのみPW照合OK）
  // - approved: ok:true + me情報
  // - pending: ok:false reason:"pending"
  // - invalid: ok:false reason:"invalid"
  // ✅ 既存機能は削除しない、列は ensureCols_ で保証（壊さない）
  // =========================================================
  if (action === "me") {
    const id = str_(body.id);
    const code = str_(body.code);

    if (!id || !code) {
      return json_({ ok: false, reason: "invalid" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "login_id",
      "pw_hash",
      "email",
      "status",
      "plan",           // ✅ 追加: プランチェックに必要
      // 紹介系（今回の目的）
      "my_ref_code",
      "ref_path",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
    ]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hit = null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = i + 2;

      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);

      // login と同仕様：login_id or email で一致
      if (id === loginId || id === email) {
        hit = { r: r, rowIndex: rowIndex };
        break;
      }
    }

    if (!hit) return json_({ ok: false, reason: "invalid" });

    // ✅ デバッグ: idx と hit.r の内容を確認（問題解消後に削除可）
    Logger.log("[me] idx: " + JSON.stringify(idx));
    Logger.log("[me] hit.r: " + JSON.stringify(hit.r));

    const status = str_(hit.r[idx["status"]]);
    if (status !== "approved") {
      // 承認前は情報を返さない（安全）
      return json_({ ok: false, reason: "pending" });
    }

    const loginId = str_(hit.r[idx["login_id"]]);
    const email = str_(hit.r[idx["email"]]);
    const pwHashSaved = str_(hit.r[idx["pw_hash"]]);

    if (!loginId || !pwHashSaved) return json_({ ok: false, reason: "invalid" });

    // PW照合（loginと同じ）
    const pwHashInput = hmacSha256Hex_(SECRET, loginId + ":" + code);
    if (pwHashInput !== pwHashSaved) return json_({ ok: false, reason: "invalid" });

    // ✅ 返すのは “必要最小限の公開情報” のみ（pw_hash等は返さない）
    return json_({
      ok: true,
      login_id: loginId,
      email: email,
      status: status,
      plan: str_(hit.r[idx["plan"]]),
      my_ref_code: str_(hit.r[idx["my_ref_code"]]),
      ref_path: str_(hit.r[idx["ref_path"]]),
      referrer_login_id: str_(hit.r[idx["referrer_login_id"]]),
      referrer_2_login_id: str_(hit.r[idx["referrer_2_login_id"]]),
      referrer_3_login_id: str_(hit.r[idx["referrer_3_login_id"]]),
    });
  }

  // =========================================================
  // login（approved/pending/invalid + pw_hash照合）
  // =========================================================
  if (action === "login") {
    const id = str_(body.id);
    const code = str_(body.code);

    if (!id || !code) {
      return json_({ ok: false, reason: "invalid" });
    }

    let values = sheet.getDataRange().getValues();
    let header = values[0];

    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, ["login_id", "pw_hash", "email", "status"]);

    values = sheet.getDataRange().getValues();
    header = values[0];

    const idx = indexMap_(header);
    const rows = values.slice(1);

    let hit = null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = i + 2;

      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);

      if (id === loginId || id === email) {
        hit = { r: r, rowIndex: rowIndex };
        break;
      }
    }

    if (!hit) return json_({ ok: false, reason: "invalid" });

    const status = str_(hit.r[idx["status"]]);
    if (status !== "approved") return json_({ ok: false, reason: "pending" });

    const loginId = str_(hit.r[idx["login_id"]]);
    const pwHashSaved = str_(hit.r[idx["pw_hash"]]);

    if (!loginId || !pwHashSaved) return json_({ ok: false, reason: "invalid" });

    const pwHashInput = hmacSha256Hex_(SECRET, loginId + ":" + code);
    if (pwHashInput !== pwHashSaved) return json_({ ok: false, reason: "invalid" });

    return json_({ ok: true });
  }

  // actionが不明
  return json_({ ok: false, error: "bad_action" });
}

// ==============================
// ✅ 承認コア（admin_approve と payment_update から共通利用）
// - 既存構造を壊さず、admin_approve の中身を集約
// - 返り値：admin_approve の従来返り値に合わせる（壊さない）
// ==============================

function approveRowCore_(sheet, header, idx, rowIndex, note) {
  try {
    // ✅ 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "email",
      "status",
      "login_id",
      "pw_hash",
      "pw_updated_at",
      "reset_token",
      "reset_expires",
      "reset_used_at",
      "reset_sent_at",

      // ✅ 紹介コード（壊さない）
      "my_ref_code",
      "ref_code",
      "referrer_login_id",
      "referrer_2_login_id",
      "referrer_3_login_id",
      "ref_path",

      // ✅ BP/EP付与（今回追加：壊さない）
      "bp_balance",
      "ep_balance",
      "bp_granted_at",
      "bp_grant_plan",
      "bp_grant_amount",
      "ep_grant_amount",

      // ✅ 紹介配当（今回追加：壊さない）
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
      "expected_paid",
      "plan",

      // ✅ メールエラーログ（デバッグ用）
      "mail_error",
    ]);

    // ✅ ensureCols_ で列が増えた可能性があるので header/idx を再生成（壊さない）
    try {
      const lastCol = sheet.getLastColumn();
      if (lastCol && lastCol > 0) {
        const h2 = sheet.getRange(1, 1, 1, lastCol).getValues();
        header = (h2 && h2[0]) ? h2[0] : header;
        idx = indexMap_(header);
      }
    } catch (e) {}

    const email = str_(sheet.getRange(rowIndex, idx["email"] + 1).getValue());
    if (!email) return { ok: false, error: "no_email" };

    // approved済みの場合の処理（壊さない）
    const curStatus = str_(sheet.getRange(rowIndex, idx["status"] + 1).getValue());
    if (curStatus === "approved") {
      const existingLoginId = str_(sheet.getRange(rowIndex, idx["login_id"] + 1).getValue());
      const existingMyRefCode = str_(sheet.getRange(rowIndex, idx["my_ref_code"] + 1).getValue());
      const sentAt = sheet.getRange(rowIndex, idx["reset_sent_at"] + 1).getValue();
      const pwHash = idx["pw_hash"] !== undefined ? str_(sheet.getRange(rowIndex, idx["pw_hash"] + 1).getValue()) : "";

      // ✅ Bug Fix: approved済みだがメール未送信かつパスワード未設定 → トークン再発行してメール再送
      // （auto_approveでstatus=approvedになった後にsendResetMail_が失敗した場合の救済）
      if (!sentAt && !pwHash && existingLoginId) {
        const newToken = genResetToken_();
        const newExpires = new Date(Date.now() + 72 * 60 * 60 * 1000);
        sheet.getRange(rowIndex, idx["reset_token"] + 1).setValue(newToken);
        sheet.getRange(rowIndex, idx["reset_expires"] + 1).setValue(newExpires);
        sheet.getRange(rowIndex, idx["reset_used_at"] + 1).setValue("");
        Logger.log("[approveRowCore_/already_approved] resending mail: to=" + email + " loginId=" + existingLoginId);
        // MailApp エラーはここで throw → outer catch で { ok: false, error } が返る
        sendResetMail_(email, existingLoginId, newToken);
        sheet.getRange(rowIndex, idx["reset_sent_at"] + 1).setValue(new Date());
        if (idx["mail_error"] !== undefined) sheet.getRange(rowIndex, idx["mail_error"] + 1).setValue("");
        Logger.log("[approveRowCore_/already_approved] mail sent OK: to=" + email);
        return {
          ok: true,
          loginId: existingLoginId || "",
          resetSent: true,
          myRefCode: existingMyRefCode || "",
          refBound: !!str_(sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).getValue()),
          bpGranted: !!sheet.getRange(rowIndex, idx["bp_granted_at"] + 1).getValue(),
          bpAdded: 0,
          epAdded: 0,
          refBonusGranted: !!sheet.getRange(rowIndex, idx["ref_bonus_granted_at"] + 1).getValue(),
          refBonusAmount: parseMoneyLike_(sheet.getRange(rowIndex, idx["ref_bonus_amount"] + 1).getValue()),
        };
      }

      return {
        ok: true,
        loginId: existingLoginId || "",
        resetSent: !!sentAt,
        myRefCode: existingMyRefCode || "",
        refBound: !!str_(sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).getValue()),
        bpGranted: !!sheet.getRange(rowIndex, idx["bp_granted_at"] + 1).getValue(),
        bpAdded: 0,
        epAdded: 0,
        refBonusGranted: !!sheet.getRange(rowIndex, idx["ref_bonus_granted_at"] + 1).getValue(),
        refBonusAmount: parseMoneyLike_(sheet.getRange(rowIndex, idx["ref_bonus_amount"] + 1).getValue()),
      };
    }

    // login ID生成（既存仕様を維持）
    let loginId = str_(sheet.getRange(rowIndex, idx["login_id"] + 1).getValue());
    if (!loginId) {
      loginId = genLoginId_();
      sheet.getRange(rowIndex, idx["login_id"] + 1).setValue(loginId);
    }

    // ✅ 本人の紹介コードを発行（R-login_id：復元可能で安全）
    let myRefCode = str_(sheet.getRange(rowIndex, idx["my_ref_code"] + 1).getValue());
    if (!myRefCode) {
      myRefCode = "R-" + loginId;
      sheet.getRange(rowIndex, idx["my_ref_code"] + 1).setValue(myRefCode);
    }

    // ✅ 入力された紹介コードから、最大3段の紹介者を確定（MLMではなく追跡用）
    const usedRefCode = str_(sheet.getRange(rowIndex, idx["ref_code"] + 1).getValue());
    const bind = resolveRefChain_(sheet, header, usedRefCode);

    if (bind && bind.ref1_login_id) {
      sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).setValue(bind.ref1_login_id);
      sheet.getRange(rowIndex, idx["referrer_2_login_id"] + 1).setValue(bind.ref2_login_id || "");
      sheet.getRange(rowIndex, idx["referrer_3_login_id"] + 1).setValue(bind.ref3_login_id || "");

      const path =
        (bind.ref1_login_id ? bind.ref1_login_id : "") +
        (bind.ref2_login_id ? " > " + bind.ref2_login_id : "") +
        (bind.ref3_login_id ? " > " + bind.ref3_login_id : "");
      sheet.getRange(rowIndex, idx["ref_path"] + 1).setValue(path);
    } else {
      // 紹介コードが無い/無効ならクリア（壊さない）
      sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).setValue("");
      sheet.getRange(rowIndex, idx["referrer_2_login_id"] + 1).setValue("");
      sheet.getRange(rowIndex, idx["referrer_3_login_id"] + 1).setValue("");
      sheet.getRange(rowIndex, idx["ref_path"] + 1).setValue("");
    }

    // ✅ ref_events に記録（監査用）
    appendRefEvent_({
      new_login_id: loginId,
      new_email: email,
      used_ref_code: usedRefCode,
      ref1_login_id: bind ? bind.ref1_login_id : "",
      ref2_login_id: bind ? bind.ref2_login_id : "",
      ref3_login_id: bind ? bind.ref3_login_id : "",
      note: note || "approveRowCore_",
    });

    // RESET TOKEN生成（30分）
    const token = genResetToken_();
    const expires = new Date(Date.now() + 72 * 60 * 60 * 1000);

    sheet.getRange(rowIndex, idx["reset_token"] + 1).setValue(token);
    sheet.getRange(rowIndex, idx["reset_expires"] + 1).setValue(expires);
    sheet.getRange(rowIndex, idx["reset_used_at"] + 1).setValue("");
    sheet.getRange(rowIndex, idx["status"] + 1).setValue("approved");

    // ✅ approved になった瞬間にBP/EPを付与（bp_granted_at で二重付与防止）（壊さない）
    let bpGranted = false;
    let bpAdded = 0;
    let epAdded = 0;

    try {
      const grantedAt = sheet.getRange(rowIndex, idx["bp_granted_at"] + 1).getValue();
      if (!grantedAt) {
        // plan を見て付与量を決める（価格は気にしない / 画像のポイント表に合わせる）
        const plan = str_(sheet.getRange(rowIndex, idx["plan"] + 1).getValue());
        const g = planToGrant_(plan);

        const curBp = Number(sheet.getRange(rowIndex, idx["bp_balance"] + 1).getValue() || 0);
        const curEp = Number(sheet.getRange(rowIndex, idx["ep_balance"] + 1).getValue() || 0);

        const nextBp = (Number.isFinite(curBp) ? curBp : 0) + (Number.isFinite(g.bp) ? g.bp : 0);
        const nextEp = (Number.isFinite(curEp) ? curEp : 0) + (Number.isFinite(g.ep) ? g.ep : 0);

        sheet.getRange(rowIndex, idx["bp_balance"] + 1).setValue(nextBp);
        sheet.getRange(rowIndex, idx["ep_balance"] + 1).setValue(nextEp);

        sheet.getRange(rowIndex, idx["bp_granted_at"] + 1).setValue(new Date());
        sheet.getRange(rowIndex, idx["bp_grant_plan"] + 1).setValue(plan);
        sheet.getRange(rowIndex, idx["bp_grant_amount"] + 1).setValue(Number.isFinite(g.bp) ? g.bp : 0);
        sheet.getRange(rowIndex, idx["ep_grant_amount"] + 1).setValue(Number.isFinite(g.ep) ? g.ep : 0);

        bpGranted = true;
        bpAdded = Number.isFinite(g.bp) ? g.bp : 0;
        epAdded = Number.isFinite(g.ep) ? g.ep : 0;
      } else {
        bpGranted = true;
        bpAdded = 0;
        epAdded = 0;
      }
    } catch (e) {}

    // ✅ 紹介配当を付与（1段のみ / plan額基準 / ref_bonus_granted_at で二重付与防止）（壊さない）
    let refBonusGranted = false;
    let refBonusAmount = 0;

    try {
      const already = sheet.getRange(rowIndex, idx["ref_bonus_granted_at"] + 1).getValue();
      if (!already) {
        const expectedCell = sheet.getRange(rowIndex, idx["expected_paid"] + 1).getValue();
        let expected = parseMoneyLike_(expectedCell);
        if (!expected || !Number.isFinite(expected) || expected <= 0) {
          const p3 = str_(sheet.getRange(rowIndex, idx["plan"] + 1).getValue());
          const exp3 = planToExpectedPaid_(p3);
          if (exp3 > 0) expected = exp3;
        }
        const childRef1 = str_(sheet.getRange(rowIndex, idx["referrer_login_id"] + 1).getValue());

        if (childRef1 && expected > 0) {
          const granted = grantReferralBonusOnce_(sheet, header, idx, rowIndex, expected, note || "approveRowCore_");
          refBonusGranted = !!(granted && granted.ok);
          refBonusAmount = granted && granted.amount ? Number(granted.amount) : 0;
        } else {
          refBonusGranted = false;
          refBonusAmount = 0;
        }
      } else {
        refBonusGranted = true;
        refBonusAmount = parseMoneyLike_(sheet.getRange(rowIndex, idx["ref_bonus_amount"] + 1).getValue());
      }
    } catch (e) {}

    // メール送信（reset_sent_at があれば送らない：二重送信防止）
    const sentAt = sheet.getRange(rowIndex, idx["reset_sent_at"] + 1).getValue();
    let resetSent = false;
    if (!sentAt) {
      Logger.log("[approveRowCore_] sending mail: to=" + email + " loginId=" + loginId + " note=" + note);
      try {
        sendResetMail_(email, loginId, token);
        sheet.getRange(rowIndex, idx["reset_sent_at"] + 1).setValue(new Date());
        if (idx["mail_error"] !== undefined) sheet.getRange(rowIndex, idx["mail_error"] + 1).setValue("");
        resetSent = true;
        Logger.log("[approveRowCore_] mail sent OK: to=" + email);
      } catch (mailErr) {
        const mailErrMsg = String(mailErr);
        Logger.log("[approveRowCore_] mail FAILED: " + mailErrMsg + " to=" + email);
        if (idx["mail_error"] !== undefined) sheet.getRange(rowIndex, idx["mail_error"] + 1).setValue(mailErrMsg);
        // rethrow して outer catch で { ok: false, error } を返す
        throw mailErr;
      }
    } else {
      resetSent = true;
    }

    return {
      ok: true,
      loginId: loginId,
      resetSent: resetSent,
      myRefCode: myRefCode,
      refBound: !!(bind && bind.ref1_login_id),
      bpGranted: bpGranted,
      bpAdded: bpAdded,
      epAdded: epAdded,
      refBonusGranted: refBonusGranted,
      refBonusAmount: refBonusAmount,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ==============================
// ✅ 紹介配当（今回追加：壊さない）
// - 1段のみ（child.referrer_login_id）
// - 基準金額：plan額（expected_paid）
// - referrer の ref_share_pct（20 or 40）を参照（手動入力）
// - wallet_ledger に記録し、child.ref_bonus_* にも記録（二重付与防止）
// ==============================

function grantReferralBonusOnce_(sheet, header, idx, childRowIndex, expectedPaid, note) {
  try {
    // 必要列保証（壊さない）
    ensureCols_(sheet, header, [
      "login_id",
      "email",
      "status",
      "plan",
      "expected_paid",
      "referrer_login_id",
      "ref_share_pct",
      "ref_bonus_granted_at",
      "ref_bonus_amount",
    ]);

    // header/idx 再生成（壊さない）
    try {
      const lastCol = sheet.getLastColumn();
      if (lastCol && lastCol > 0) {
        const h2 = sheet.getRange(1, 1, 1, lastCol).getValues();
        header = (h2 && h2[0]) ? h2[0] : header;
        idx = indexMap_(header);
      }
    } catch (e) {}

    const already = sheet.getRange(childRowIndex, idx["ref_bonus_granted_at"] + 1).getValue();
    if (already) {
      return { ok: true, already: true, amount: parseMoneyLike_(sheet.getRange(childRowIndex, idx["ref_bonus_amount"] + 1).getValue()) };
    }

    const childStatus = str_(sheet.getRange(childRowIndex, idx["status"] + 1).getValue());
    if (childStatus !== "approved" && childStatus !== "paid") {
      return { ok: false, error: "child_not_approved" };
    }

    const ref1 = str_(sheet.getRange(childRowIndex, idx["referrer_login_id"] + 1).getValue());
    if (!ref1) {
      return { ok: false, error: "no_referrer" };
    }

    // referrer 行を探す（login_id一致）
    const values = getValuesSafe_(sheet);
    const h = values[0];
    const im = indexMap_(h);
    const rows = values.slice(1);

    if (im["login_id"] === undefined) return { ok: false, error: "missing_login_id_col" };
    if (im["ref_share_pct"] === undefined) return { ok: false, error: "missing_ref_share_pct_col" };

    let refRowIndex = 0;
    let refSharePct = 0;
    let refEmail = "";
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const loginId = str_(r[im["login_id"]]);
      if (loginId && loginId === ref1) {
        refRowIndex = i + 2;
        refSharePct = parseMoneyLike_(r[im["ref_share_pct"]]);
        refEmail = im["email"] !== undefined ? str_(r[im["email"]]) : "";
        break;
      }
    }

    if (!refRowIndex) {
      return { ok: false, error: "referrer_not_found" };
    }

    const pctOk = refSharePct === 20 || refSharePct === 40;
    if (!pctOk) {
      return { ok: false, error: "ref_share_pct_invalid" };
    }

    const base = Number(expectedPaid || 0);
    if (!Number.isFinite(base) || base <= 0) {
      return { ok: false, error: "bad_expected_paid" };
    }

    const amount = base * (refSharePct / 100);

    // wallet_ledger に追記（壊さない）
    try {
      appendWalletLedger_({
        ts: new Date(),
        kind: "referral_bonus",
        login_id: ref1,
        email: refEmail,
        amount: amount,
        memo: "childRow=" + String(childRowIndex) + " base=" + String(base) + " pct=" + String(refSharePct) + " note=" + str_(note),
      });
    } catch (e) {}

    // child 側に付与済みを刻む（壊さない）
    sheet.getRange(childRowIndex, idx["ref_bonus_amount"] + 1).setValue(amount);
    sheet.getRange(childRowIndex, idx["ref_bonus_granted_at"] + 1).setValue(new Date());

    return { ok: true, amount: amount, pct: refSharePct, referrer: ref1 };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function getOrCreateRadioSongsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return getOrCreateSheetByName_(ss, "radio_songs", [
    "song_id",
    "title",
    "artist",
    "service_links",
    "thumbnail_url",
    "active",
    "created_at",
  ]);
}

function getOrCreateRadioMissionsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return getOrCreateSheetByName_(ss, "radio_missions", [
    "mission_id",
    "login_id",
    "song_id",
    "started_at",
    "submitted_at",
    "status",
    "ep_granted",
    "screenshot_note",
  ]);
}

function getOrCreateStakingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return getOrCreateSheetByName_(ss, "staking", [
    "stake_id",
    "login_id",
    "staked_bp",
    "rate",
    "started_at",
    "expires_at",
    "status",
    "claimed_at",
    "interest_bp",
    "total_bp",
  ]);
}

function appendWalletLedger_(o) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const led = getOrCreateSheetByName_(ss, "wallet_ledger", [
    "ts",
    "kind",
    "login_id",
    "email",
    "amount",
    "memo",
  ]);

  led.appendRow([
    o.ts ? o.ts : new Date(),
    str_(o.kind),
    str_(o.login_id),
    str_(o.email),
    Number(o.amount || 0),
    str_(o.memo),
  ]);
}

// ==============================
// ✅ Plan -> expected_paid（今回追加：壊さない）
// - plan が数値ならそのまま採用
// - 文字列プランでも最低限対応できるように保険
// - 期待金額が不明なら 0 を返す（payment_update側で pending_error に落とす）
// ==============================

function planToExpectedPaid_(plan) {
  const p = str_(plan).trim();

  // 数値っぽいならそのまま（例："34" / "2000" / 34）
  const n = parseMoneyLike_(p);
  if (Number.isFinite(n) && n > 0) return n;

  // 文字列プランの保険（必要ならここに足すだけで壊れない）
  // 例： "plan_34" / "basic_34" などに対応したい場合
  // 今は不明なので 0 を返す（壊さない）
  return 0;
}

// ==============================
// ✅ Plan -> BP/EP付与（今回追加：壊さない）
// - 価格は気にしない / 画像のポイント表に合わせる
// - plan が数値（34/57/114/567/1134）なら対応
// - 不明なら 0 を返す（壊さない）
// ==============================

function planToGrant_(plan) {
  const p = str_(plan).trim();
  const n = parseMoneyLike_(p);

  // 画像のポイント表（固定）
  // Starter 34 USDT -> 300BP付与
  // Builder 57 USDT -> 600BP付与
  // Automation 114 USDT -> 1200BP付与
  // Core 567 USDT -> 6000BP付与
  // Infra 1,134 USDT -> 12000BP付与
  if (Number.isFinite(n)) {
    if (n === 34) return { bp: 300, ep: 0 };
    if (n === 57) return { bp: 600, ep: 0 };
    if (n === 114) return { bp: 1200, ep: 0 };
    if (n === 567) return { bp: 6000, ep: 0 };
    if (n === 1134) return { bp: 12000, ep: 0 };
  }

  return { bp: 0, ep: 0 };
}

// ==============================
// ✅ 金額っぽい文字列を数値化（今回追加：壊さない）
// - "34" / "34.00" / "1,234.56" / "USDT 34" 等を許容
// ==============================

function parseMoneyLike_(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  // 数字/小数点/カンマ以外を除去
  const cleaned = s.replace(/[^\d.,-]/g, "");

  // カンマを除去（"1,234.56" -> "1234.56"）
  const normalized = cleaned.replace(/,/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

// ==============================
// RESET MAIL
// ==============================

function sendResetMail_(to, loginId, token) {
  // ✅ デバッグログ（GAS実行ログで確認可能）
  Logger.log("[sendResetMail_] called: to=" + to + " loginId=" + loginId + " tokenLen=" + (token ? token.length : 0));

  if (!to) {
    Logger.log("[sendResetMail_] ABORT: to is empty");
    throw new Error("sendResetMail_: to address is empty");
  }
  if (!loginId) {
    Logger.log("[sendResetMail_] ABORT: loginId is empty");
    throw new Error("sendResetMail_: loginId is empty");
  }
  if (!token) {
    Logger.log("[sendResetMail_] ABORT: token is empty");
    throw new Error("sendResetMail_: token is empty");
  }

  // ✅ クォータチェック（残り0なら即エラー）
  try {
    const remaining = MailApp.getRemainingDailyQuota();
    Logger.log("[sendResetMail_] quota remaining=" + remaining);
    if (remaining <= 0) {
      throw new Error("sendResetMail_: MailApp daily quota exhausted (remaining=0)");
    }
  } catch (quotaErr) {
    // getRemainingDailyQuota 自体が失敗することはほぼないが安全のため
    Logger.log("[sendResetMail_] quota check error: " + String(quotaErr));
    throw quotaErr;
  }

  const url = "https://lifai.vercel.app/reset?token=" + encodeURIComponent(token);
  const subject = "【LIFAI】初回パスワード設定のご案内";

  const body =
    "LIFAIへのご登録ありがとうございます。\n\n" +
    "初回パスワード設定はこちら（72時間有効）：\n" +
    url +
    "\n\n" +
    "ログインID：\n" +
    loginId +
    "\n\n" +
    "このURLは1回のみ利用できます。\n\n" +
    "もしパスワードの設定がうまくできなかった場合は、公式LINEにてお名前とメールアドレスを添えてご連絡ください。\n" +
    "対応いたします。\n" +
    "https://lin.ee/VPo2xOn\n\n" +
    "LIFAI公式";

  Logger.log('[sendMail] to=' + to);
  try {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      name: "LIFAI公式",
    });
    Logger.log('[sendMail] SUCCESS');
  } catch (e) {
    Logger.log('[sendMail] FAILED: ' + e);
    // mail_error列への書き込みはシート参照を持つ呼び出し元（approveRowCore_ 等）で行う
    throw e;
  }
}

// ==============================
// ✅ Referral Helpers（今回追加：壊さない）
// ==============================

function resolveRefChain_(sheet, header, usedRefCode) {
  // usedRefCode (= ref_code) から、ref1/ref2/ref3 を特定して返す
  // 仕様：my_ref_code が一致する行 = 紹介者(1段目)
  // 2段目/3段目は紹介者行の referrer_* を引き継ぐ（MLMではなく追跡用）
  if (!usedRefCode) {
    return { ref1_login_id: "", ref2_login_id: "", ref3_login_id: "" };
  }

  // ✅ 既存は getDataRange() だったが、巨大DataRange対策として getValuesSafe_ を利用（壊さない）
  const values = getValuesSafe_(sheet);
  const h = values[0];
  const idx = indexMap_(h);
  const rows = values.slice(1);

  // 必要列が無ければ安全に空で返す（壊さない）
  if (idx["my_ref_code"] === undefined || idx["login_id"] === undefined) {
    return { ref1_login_id: "", ref2_login_id: "", ref3_login_id: "" };
  }

  let ref1 = "";
  let ref2 = "";
  let ref3 = "";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (str_(r[idx["my_ref_code"]]) === usedRefCode) {
      ref1 = str_(r[idx["login_id"]]);

      // 2〜3段は親の値を引き継ぐ（なければ空）
      ref2 = idx["referrer_login_id"] !== undefined ? str_(r[idx["referrer_login_id"]]) : "";
      ref3 = idx["referrer_2_login_id"] !== undefined ? str_(r[idx["referrer_2_login_id"]]) : "";
      break;
    }
  }

  return { ref1_login_id: ref1, ref2_login_id: ref2, ref3_login_id: ref3 };
}

function appendRefEvent_(o) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ev = getOrCreateSheetByName_(ss, "ref_events", [
      "ts",
      "new_login_id",
      "new_email",
      "used_ref_code",
      "ref1_login_id",
      "ref2_login_id",
      "ref3_login_id",
      "note",
    ]);

    ev.appendRow([
      new Date(),
      str_(o.new_login_id),
      str_(o.new_email),
      str_(o.used_ref_code),
      str_(o.ref1_login_id),
      str_(o.ref2_login_id),
      str_(o.ref3_login_id),
      str_(o.note),
    ]);
  } catch (e) {
    // ログだけ（壊さない）
  }
}

function getOrCreateSheetByName_(ss, name, headerRow) {
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    if (headerRow && headerRow.length) {
      s.appendRow(headerRow);
    }
  } else {
    // ヘッダーが空なら入れておく（壊さない）
    try {
      const lastRow = s.getLastRow();
      const lastCol = s.getLastColumn();

      // シートが空っぽ
      if (!lastRow || lastRow < 1 || !lastCol || lastCol < 1) {
        if (headerRow && headerRow.length) {
          s.appendRow(headerRow);
        }
      } else {
        // 1行目だけ安全に見る（DataRange爆発を踏まない）
        const firstRow = s.getRange(1, 1, 1, lastCol).getValues();
        const joined = (firstRow[0] || []).join("");
        if (joined === "") {
          if (headerRow && headerRow.length) {
            s.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
          }
        }
      }
    } catch (e) {}
  }
  return s;
}

// ==============================
// Helpers
// ==============================

function getSecrets_() {
  const props = PropertiesService.getScriptProperties();
  const SECRET = props.getProperty("SECRET_KEY") || "LIFAITOMAKEMONEY";
  const ADMIN_SECRET = props.getProperty("ADMIN_SECRET") || "CHANGE_ME_ADMIN_123";
  return { SECRET: SECRET, ADMIN_SECRET: ADMIN_SECRET };
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("applies");

  if (!sheet) {
    sheet = ss.insertSheet("applies");
    sheet.appendRow([
      "created_at",
      "plan",
      "email",
      "name",
      "name_kana",
      "ref_name",
      "ref_id",
      "region",
      "status",
      "code",
      "code_expires_at",
      "code_used_at",
      "apply_id",
      // ✅ サブスク・優先度カラム（壊さない：新規シート用）
      "subscription_plan",       // free / plus / pro / priority / partner
      "subscription_status",     // inactive / active / cancelled / past_due
      "subscription_started_at", // 開始日時
      "subscription_period_end", // 次回更新日
      "bp_cap",                  // BP上限値（サブスクプランで決まる）
      "bp_last_reset_at",        // 最後のBPリセット日時
      "job_priority_score",      // ジョブ優先度スコア（数値）
      "music_priority_level",    // 音楽案件優先レベル（0〜4）
      // ✅ ログインボーナス・日次集計カラム（壊さない：新規シート用）
      "last_login_at",           // 最終ログイン日時
      "login_streak",            // 連続ログイン日数
      "daily_bp_earned",         // 今日獲得したBP（日次リセット用）
      "daily_ep_earned",         // 今日獲得したEP（日次リセット用）
      "daily_reset_date",        // daily_bp/epをリセットした日付（YYYY-MM-DD）
      "total_login_count",       // 累計ログイン回数
    ]);
  }

  // ✅ 既存シートにも新カラムを追加（ヘッダー行のみ・データ行は変更しない）
  const lastCol = sheet.getLastColumn();
  const header = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  ensureCols_(sheet, header, [
    "subscription_plan",
    "subscription_status",
    "subscription_started_at",
    "subscription_period_end",
    "bp_cap",
    "bp_last_reset_at",
    "job_priority_score",
    "music_priority_level",
    // ✅ ログインボーナス・日次集計カラム（壊さない）
    "last_login_at",       // 最終ログイン日時
    "login_streak",        // 連続ログイン日数
    "daily_bp_earned",     // 今日獲得したBP（日次リセット用）
    "daily_ep_earned",     // 今日獲得したEP（日次リセット用）
    "daily_reset_date",    // daily_bp/epをリセットした日付（YYYY-MM-DD）
    "total_login_count",   // 累計ログイン回数
  ]);

  return sheet;
}

function ensureCols_(sheet, header, cols) {
  for (var k = 0; k < cols.length; k++) {
    if (header.indexOf(cols[k]) === -1) {
      sheet.getRange(1, header.length + 1).setValue(cols[k]);
      header.push(cols[k]);
    }
  }
}

// ✅ 追加（今回）：巨大なDataRangeで落ちないように “実データ範囲だけ” を読む
function getValuesSafe_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (!lastRow || lastRow < 1 || !lastCol || lastCol < 1) return [[]];
  return sheet.getRange(1, 1, lastRow, lastCol).getValues();
}

function pickKey_(e) {
  const key1 = e?.parameter?.key ? String(e.parameter.key) : "";
  const key2 = e?.parameters?.key?.[0] ? String(e.parameters.key[0]) : "";
  return key1 || key2 || "";
}

function indexMap_(header) {
  const map = {};
  header.forEach((h, i) => (map[String(h)] = i));
  return map;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function str_(v) {
  return v === undefined || v === null ? "" : String(v);
}

function num_(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ✅ DataRange爆発を避ける（壊さない）
function getSheetValuesSafe_(s) {
  const lr = s.getLastRow();
  const lc = s.getLastColumn();
  if (!lr || lr < 1 || !lc || lc < 1) return [[]];
  return s.getRange(1, 1, lr, lc).getValues();
}
// ==============================
// Password / LoginId Helpers
// ==============================

function bytesToHex_(bytes) {
  return bytes
    .map(function (b) {
      var v = b < 0 ? b + 256 : b;
      return (v < 16 ? "0" : "") + v.toString(16);
    })
    .join("");
}

function hmacSha256Hex_(secret, text) {
  var sig = Utilities.computeHmacSha256Signature(text, secret);
  return bytesToHex_(sig);
}

function randChars_(len) {
  // 紛らわしい文字を避ける（0,O,1,l を抜く）
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  var out = "";
  for (var i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function genLoginId_() {
  return "lifai_" + randChars_(6);
}

// 旧仕様の互換用：削除しない（今はadmin_approveでは使わない）
function genTempPassword_() {
  return randChars_(12);
}

// RESET TOKEN
function genResetToken_() {
  return Utilities.getUuid().replace(/-/g, "") + randChars_(16);
}

function __testSendMailOnce() {
  sendResetMail_("unitegawa@outlook.jp", "lifai_TEST", "TEST_TOKEN_123");
}

// ==============================
// ✅ デバッグ用：手動実行でメール送信テスト
// GASエディタ上で関数を選択して「実行」ボタンを押す
// ==============================

// クォータ残量確認（ログで確認）
function __debugCheckMailQuota() {
  const remaining = MailApp.getRemainingDailyQuota();
  Logger.log("[__debugCheckMailQuota] remaining=" + remaining);
  return remaining;
}

// 任意メアドへテスト送信（引数なしならデフォルト宛先へ）
function __debugSendMail(email) {
  const target = email || "unitegawa@outlook.jp";
  Logger.log("[__debugSendMail] start: target=" + target);
  Logger.log("[__debugSendMail] quota=" + MailApp.getRemainingDailyQuota());
  try {
    sendResetMail_(target, "debug_login_id", "debug_token_0000000000000000");
    Logger.log("[__debugSendMail] SUCCESS");
    return "OK: mail sent to " + target;
  } catch (e) {
    Logger.log("[__debugSendMail] FAILED: " + String(e));
    return "NG: " + String(e);
  }
}

// シートの特定行を強制再承認（email指定）
function __debugApproveByEmail(email) {
  const sheet = getOrCreateSheet_();
  const values = getValuesSafe_(sheet);
  const header = values[0];
  const idx = indexMap_(header);
  const rows = values.slice(1);

  const emailIdx = idx["email"];
  if (emailIdx === undefined) {
    Logger.log("[__debugApproveByEmail] email column not found");
    return "NG: email column not found";
  }

  let targetRowIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    if (str_(rows[i][emailIdx]) === email) {
      targetRowIndex = i + 2;
      break;
    }
  }

  if (!targetRowIndex) {
    Logger.log("[__debugApproveByEmail] not found: " + email);
    return "NG: email not found in sheet";
  }

  Logger.log("[__debugApproveByEmail] found at row=" + targetRowIndex + " email=" + email);

  // reset_sent_at を強制クリアして再送を許可
  if (idx["reset_sent_at"] !== undefined) {
    sheet.getRange(targetRowIndex, idx["reset_sent_at"] + 1).setValue("");
    Logger.log("[__debugApproveByEmail] reset_sent_at cleared");
  }
  // pw_hash も強制クリア（再設定フローを開始させる）
  if (idx["pw_hash"] !== undefined) {
    sheet.getRange(targetRowIndex, idx["pw_hash"] + 1).setValue("");
    Logger.log("[__debugApproveByEmail] pw_hash cleared");
  }

  const res = approveRowCore_(sheet, header, idx, targetRowIndex, "debug_force_approve");
  Logger.log("[__debugApproveByEmail] result=" + JSON.stringify(res));
  return JSON.stringify(res);
}

// ==============================
// MARKET機能（追記のみ・既存コードは一切触らない）
// ✅ 追加シート: market_items / market_orders / market_escrow / market_reports / market_daily_limits
// ✅ 追加アクション: market_list / market_item / market_create / market_buy / market_confirm / market_refund / market_report
// ✅ doPost / doGet を末尾再定義して market_ アクションをルーティング（GAS V8では末尾定義が優先）
// ==============================

// ---- 定数 ----
var MARKET_FEE_RATE_ = 0.055;
var MARKET_DAILY_LIST_LIMIT_ = 5;
var MARKET_REPORT_HIDDEN_THRESHOLD_ = 3;
var MARKET_SYSTEM_TREASURY_ = "SYSTEM_TREASURY";
var MARKET_SYSTEM_ESCROW_ = "SYSTEM_ESCROW";
var MARKET_MIN_PRICE_ = 50;
var MARKET_MIN_EP_TO_LIST_ = 1;
var MARKET_RESERVE_HOURS_ = 24;

// ---- doPost 再定義（market_ アクションを handleMarket_ へルーティング）----
function doPost(e) {
  try {
    const key = pickKey_(e);
    const body = JSON.parse(e?.postData?.contents || "{}");
    const action = str_(body.action);
    if (action && action.startsWith("market_")) {
      return handleMarket_(key, body);
    }
    return handle_(key, body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---- doGet 再定義（market_ アクションを handleMarket_ へルーティング、既存ロジックは保持）----
function doGet(e) {
  try {
    const key = pickKey_(e);
    const action = str_(e?.parameter?.action);

    if (!action) {
      return json_({ ok: false, error: "method_not_allowed" });
    }

    if (action.startsWith("market_")) {
      const body = {
        action,
        id: str_(e?.parameter?.id),
        code: str_(e?.parameter?.code),
        adminKey: str_(e?.parameter?.adminKey),
        item_id: str_(e?.parameter?.item_id),
        order_id: str_(e?.parameter?.order_id),
        status: str_(e?.parameter?.status),
        page: num_(e?.parameter?.page),
        limit: num_(e?.parameter?.limit),
        title: str_(e?.parameter?.title),
        desc: str_(e?.parameter?.desc),
        item_type: str_(e?.parameter?.item_type),
        asset_count: num_(e?.parameter?.asset_count),
        currency: str_(e?.parameter?.currency),
        price: num_(e?.parameter?.price),
        delivery_mode: str_(e?.parameter?.delivery_mode),
        delivery_ref: str_(e?.parameter?.delivery_ref),
        stock_total: num_(e?.parameter?.stock_total),
        reason: str_(e?.parameter?.reason),
        message: str_(e?.parameter?.message),
        note: str_(e?.parameter?.note),
      };
      return handleMarket_(key, body);
    }

    // 既存 doGet ロジック（handle_ へのルーティング）
    const pseudoBody = {
      action,
      adminKey: str_(e?.parameter?.adminKey),
      rowIndex: num_(e?.parameter?.rowIndex),
      id: str_(e?.parameter?.id),
      code: str_(e?.parameter?.code),
      plan: str_(e?.parameter?.plan),
      email: str_(e?.parameter?.email),
      name: str_(e?.parameter?.name),
      nameKana: str_(e?.parameter?.nameKana),
      discordId: str_(e?.parameter?.discordId),
      ageBand: str_(e?.parameter?.ageBand),
      prefecture: str_(e?.parameter?.prefecture),
      city: str_(e?.parameter?.city),
      job: str_(e?.parameter?.job),
      refName: str_(e?.parameter?.refName),
      refId: str_(e?.parameter?.refId),
      refCode: str_(e?.parameter?.refCode),
      region: str_(e?.parameter?.region),
      applyId: str_(e?.parameter?.applyId),
      orderId: str_(e?.parameter?.orderId),
      paymentStatus: str_(e?.parameter?.paymentStatus),
      isPaid: str_(e?.parameter?.isPaid),
      invoiceId: str_(e?.parameter?.invoiceId),
      actuallyPaid: str_(e?.parameter?.actuallyPaid),
      payAmount: str_(e?.parameter?.payAmount),
      payCurrency: str_(e?.parameter?.payCurrency),
      priceAmount: str_(e?.parameter?.priceAmount),
      priceCurrency: str_(e?.parameter?.priceCurrency),
      token: str_(e?.parameter?.token),
      password: str_(e?.parameter?.password),
    };
    return handle_(key, pseudoBody);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ==============================
// handleMarket_ : market_* アクションのメインハンドラ
// ==============================
function handleMarket_(key, body) {
  const secrets = getSecrets_();
  if (key !== secrets.SECRET) return json_({ ok: false, error: "unauthorized" });
  const SECRET = secrets.SECRET;
  const ADMIN_SECRET = secrets.ADMIN_SECRET;

  const action = str_(body.action);

  // =========================================================
  // market_list（一覧取得：認証不要）
  // =========================================================
  if (action === "market_list") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = mktGetSheet_(ss, "market_items");
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return json_({ ok: true, items: [], total: 0 });

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    const filterStatus = str_(body.status) || "active";
    const page = Math.max(1, num_(body.page) || 1);
    const limit = Math.min(50, Math.max(1, num_(body.limit) || 20));
    const offset = (page - 1) * limit;

    let filtered = rows.filter(function(r) {
      return str_(r[idx["status"]]) === filterStatus;
    });
    // seller_idフィルター（追記）
    filtered = body.seller_id
      ? filtered.filter(function(r) { return str_(r[idx["seller_id"]]) === str_(body.seller_id); })
      : filtered;
    const paged = filtered.slice(offset, offset + limit);
    const items = paged.map(function(r) { return mktRowToItem_(r, idx); });

    return json_({ ok: true, items: items, total: filtered.length, page: page, limit: limit });
  }

  // =========================================================
  // market_item（詳細取得：認証不要）
  // =========================================================
  if (action === "market_item") {
    const itemId = str_(body.item_id);
    if (!itemId) return json_({ ok: false, error: "missing_item_id" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = mktGetSheet_(ss, "market_items");
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return json_({ ok: false, error: "not_found" });

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["item_id"]]) === itemId) {
        return json_({ ok: true, item: mktRowToItem_(rows[i], idx) });
      }
    }
    return json_({ ok: false, error: "not_found" });
  }

  // =========================================================
  // market_create（出品：1日5件制限・EP制限・最低価格50・最低枚数チェック）
  // =========================================================
  if (action === "market_create") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = mktAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed", reason: user.reason });

    const title = str_(body.title).trim();
    const desc = str_(body.desc).trim();
    const itemType = str_(body.item_type).trim();
    const currency = str_(body.currency).trim() || "EP";
    const price = num_(body.price);
    const deliveryMode = str_(body.delivery_mode).trim();
    const deliveryRef = str_(body.delivery_ref).trim();
    const stockTotal = Math.max(1, num_(body.stock_total) || 1);
    const assetCount = num_(body.asset_count) || 0;

    if (!title) return json_({ ok: false, error: "missing_title" });
    if (!itemType) return json_({ ok: false, error: "missing_item_type" });
    if (price < MARKET_MIN_PRICE_) {
      return json_({ ok: false, error: "price_too_low", min: MARKET_MIN_PRICE_ });
    }

    // 最低枚数チェック（asset系は1枚以上必須）
    if (itemType === "nft" || itemType === "asset" || itemType === "digital_item") {
      if (assetCount < 1) {
        return json_({ ok: false, error: "asset_count_required", min: 1 });
      }
    }

    // EP制限チェック
    if (user.ep_balance < MARKET_MIN_EP_TO_LIST_) {
      return json_({ ok: false, error: "ep_insufficient_to_list", required: MARKET_MIN_EP_TO_LIST_, current: user.ep_balance });
    }

    // 1日5件制限
    const today = mktTodayJst_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const limitSheet = mktGetSheet_(ss, "market_daily_limits");
    const listedCount = mktGetDailyListCount_(limitSheet, user.login_id, today);
    if (listedCount >= MARKET_DAILY_LIST_LIMIT_) {
      return json_({ ok: false, error: "daily_limit_exceeded", limit: MARKET_DAILY_LIST_LIMIT_ });
    }

    const itemId = "ITM_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
    const now = new Date();
    const itemSheet = mktGetSheet_(ss, "market_items");

    itemSheet.appendRow([
      itemId,                               // item_id
      user.login_id,                        // seller_id
      user.name || user.login_id,           // seller_name
      title,                                // title
      desc,                                 // desc
      itemType,                             // item_type
      assetCount,                           // asset_count
      currency,                             // currency
      price,                                // price
      MARKET_FEE_RATE_,                     // fee_rate
      deliveryMode,                         // delivery_mode
      deliveryRef,                          // delivery_ref
      stockTotal,                           // stock_total
      0,                                    // stock_sold
      0,                                    // stock_reserved
      "active",                             // status
      0,                                    // report_count
      now,                                  // created_at
      now,                                  // updated_at
    ]);

    mktIncrDailyListCount_(limitSheet, user.login_id, today);

    return json_({ ok: true, item_id: itemId });
  }

  // =========================================================
  // market_buy（即購入：在庫予約ロック→残高確認→エスクロー移転）
  // =========================================================
  if (action === "market_buy") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = mktAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed", reason: user.reason });

    const itemId = str_(body.item_id);
    if (!itemId) return json_({ ok: false, error: "missing_item_id" });

    const lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (e) { return json_({ ok: false, error: "lock_timeout" }); }

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const itemSheet = mktGetSheet_(ss, "market_items");
      const itemValues = getValuesSafe_(itemSheet);
      if (itemValues.length < 2) return json_({ ok: false, error: "not_found" });

      const iHeader = itemValues[0];
      const iIdx = indexMap_(iHeader);
      const iRows = itemValues.slice(1);

      var itemRowIndex = -1;
      var itemRow = null;
      for (var i = 0; i < iRows.length; i++) {
        if (str_(iRows[i][iIdx["item_id"]]) === itemId) {
          itemRowIndex = i + 2;
          itemRow = iRows[i];
          break;
        }
      }
      if (!itemRow) return json_({ ok: false, error: "not_found" });

      if (str_(itemRow[iIdx["status"]]) !== "active") {
        return json_({ ok: false, error: "item_not_available" });
      }

      const sellerId = str_(itemRow[iIdx["seller_id"]]);
      if (sellerId === user.login_id) {
        return json_({ ok: false, error: "cannot_buy_own_item" });
      }

      const stockTotal = num_(itemRow[iIdx["stock_total"]]);
      const stockSold = num_(itemRow[iIdx["stock_sold"]]);
      const stockReserved = num_(itemRow[iIdx["stock_reserved"]]);
      if (stockTotal - stockSold - stockReserved < 1) {
        return json_({ ok: false, error: "out_of_stock" });
      }

      const price = num_(itemRow[iIdx["price"]]);
      const currency = str_(itemRow[iIdx["currency"]]);

      // 残高確認
      if (user.ep_balance < price) {
        return json_({ ok: false, error: "ep_insufficient", required: price, current: user.ep_balance });
      }

      // 在庫予約ロック
      itemSheet.getRange(itemRowIndex, iIdx["stock_reserved"] + 1).setValue(stockReserved + 1);
      itemSheet.getRange(itemRowIndex, iIdx["updated_at"] + 1).setValue(new Date());

      // 注文作成
      const orderId = "ORD_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
      const feeAmount = Math.round(price * MARKET_FEE_RATE_ * 100) / 100;
      const sellerNet = Math.round((price - feeAmount) * 100) / 100;
      const now = new Date();
      const reservedUntil = new Date(now.getTime() + MARKET_RESERVE_HOURS_ * 60 * 60 * 1000);

      const orderSheet = mktGetSheet_(ss, "market_orders");
      orderSheet.appendRow([
        orderId,        // order_id
        itemId,         // item_id
        user.login_id,  // buyer_id
        sellerId,       // seller_id
        currency,       // currency
        price,          // price
        feeAmount,      // fee_amount
        sellerNet,      // seller_net
        "paid",         // status（即時エスクロー移転）
        reservedUntil,  // reserved_until
        now,            // paid_at
        "",             // delivered_at
        "",             // confirmed_at
        "",             // refunded_at
        "",             // note
        now,            // created_at
        now,            // updated_at
      ]);

      // エスクロー作成
      const escrowId = "ESC_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
      const escrowSheet = mktGetSheet_(ss, "market_escrow");
      escrowSheet.appendRow([
        escrowId,  // escrow_id
        orderId,   // order_id
        currency,  // currency
        price,     // hold_amount
        "held",    // state
        now,       // created_at
        now,       // updated_at
      ]);

      // 買い手 EP をデビット
      mktAdjustEp_(user.login_id, user.email, -price, "market_buy",
        "order=" + orderId + " item=" + itemId);

      return json_({
        ok: true,
        order_id: orderId,
        escrow_id: escrowId,
        price: price,
        fee_amount: feeAmount,
        seller_net: sellerNet,
      });
    } finally {
      lock.releaseLock();
    }
  }

  // =========================================================
  // market_confirm（受領確定：手数料5.5%→運営・残りを出品者に）
  // =========================================================
  if (action === "market_confirm") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = mktAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed", reason: user.reason });

    const orderId = str_(body.order_id);
    if (!orderId) return json_({ ok: false, error: "missing_order_id" });

    const lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (e) { return json_({ ok: false, error: "lock_timeout" }); }

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const orderSheet = mktGetSheet_(ss, "market_orders");
      const orderValues = getValuesSafe_(orderSheet);
      if (orderValues.length < 2) return json_({ ok: false, error: "not_found" });

      const oHeader = orderValues[0];
      const oIdx = indexMap_(oHeader);
      const oRows = orderValues.slice(1);

      var orderRowIndex = -1;
      var orderRow = null;
      for (var i = 0; i < oRows.length; i++) {
        if (str_(oRows[i][oIdx["order_id"]]) === orderId) {
          orderRowIndex = i + 2;
          orderRow = oRows[i];
          break;
        }
      }
      if (!orderRow) return json_({ ok: false, error: "not_found" });

      // 買い手のみ確定できる
      const buyerId = str_(orderRow[oIdx["buyer_id"]]);
      if (buyerId !== user.login_id) return json_({ ok: false, error: "not_buyer" });

      const orderStatus = str_(orderRow[oIdx["status"]]);
      if (orderStatus !== "paid") {
        return json_({ ok: false, error: "invalid_order_status", status: orderStatus });
      }

      const sellerId = str_(orderRow[oIdx["seller_id"]]);
      const itemId = str_(orderRow[oIdx["item_id"]]);
      const price = num_(orderRow[oIdx["price"]]);
      const feeAmount = num_(orderRow[oIdx["fee_amount"]]);
      const sellerNet = num_(orderRow[oIdx["seller_net"]]);
      const now = new Date();

      // 注文ステータス更新
      orderSheet.getRange(orderRowIndex, oIdx["status"] + 1).setValue("confirmed");
      orderSheet.getRange(orderRowIndex, oIdx["confirmed_at"] + 1).setValue(now);
      orderSheet.getRange(orderRowIndex, oIdx["updated_at"] + 1).setValue(now);

      // エスクロー → released
      const escrowSheet = mktGetSheet_(ss, "market_escrow");
      const escrowValues = getValuesSafe_(escrowSheet);
      if (escrowValues.length >= 2) {
        const eHeader = escrowValues[0];
        const eIdx = indexMap_(eHeader);
        const eRows = escrowValues.slice(1);
        for (var j = 0; j < eRows.length; j++) {
          if (str_(eRows[j][eIdx["order_id"]]) === orderId &&
              str_(eRows[j][eIdx["state"]]) === "held") {
            escrowSheet.getRange(j + 2, eIdx["state"] + 1).setValue("released");
            escrowSheet.getRange(j + 2, eIdx["updated_at"] + 1).setValue(now);
            break;
          }
        }
      }

      // 在庫更新: stock_sold++ / stock_reserved--
      const itemSheet = mktGetSheet_(ss, "market_items");
      const itemValues = getValuesSafe_(itemSheet);
      if (itemValues.length >= 2) {
        const iHeader = itemValues[0];
        const iIdx = indexMap_(iHeader);
        const iRows = itemValues.slice(1);
        for (var k = 0; k < iRows.length; k++) {
          if (str_(iRows[k][iIdx["item_id"]]) === itemId) {
            const curSold = num_(iRows[k][iIdx["stock_sold"]]);
            const curReserved = num_(iRows[k][iIdx["stock_reserved"]]);
            const stockTotal = num_(iRows[k][iIdx["stock_total"]]);
            itemSheet.getRange(k + 2, iIdx["stock_sold"] + 1).setValue(curSold + 1);
            itemSheet.getRange(k + 2, iIdx["stock_reserved"] + 1).setValue(Math.max(0, curReserved - 1));
            itemSheet.getRange(k + 2, iIdx["updated_at"] + 1).setValue(now);
            // 在庫切れなら sold_out に
            if (curSold + 1 >= stockTotal) {
              itemSheet.getRange(k + 2, iIdx["status"] + 1).setValue("sold_out");
            }
            break;
          }
        }
      }

      // 出品者に seller_net を付与
      const sellerUser = mktGetUserByLoginId_(sellerId);
      mktAdjustEp_(sellerId, sellerUser ? sellerUser.email : "", sellerNet,
        "market_confirm_seller", "order=" + orderId + " item=" + itemId + " net=" + sellerNet);

      // 手数料を SYSTEM_TREASURY へ記録（wallet_ledger のみ）
      try {
        appendWalletLedger_({
          ts: now,
          kind: "market_confirm_fee",
          login_id: MARKET_SYSTEM_TREASURY_,
          email: "",
          amount: feeAmount,
          memo: "order=" + orderId + " item=" + itemId + " fee=" + feeAmount,
        });
      } catch (e) {}

      return json_({ ok: true, order_id: orderId, seller_net: sellerNet, fee_amount: feeAmount });
    } finally {
      lock.releaseLock();
    }
  }

  // =========================================================
  // market_refund（返金：adminKeyが必要）
  // =========================================================
  if (action === "market_refund") {
    const adminKey = str_(body.adminKey);
    if (adminKey !== ADMIN_SECRET) return json_({ ok: false, error: "admin_unauthorized" });

    const orderId = str_(body.order_id);
    if (!orderId) return json_({ ok: false, error: "missing_order_id" });

    const lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (e) { return json_({ ok: false, error: "lock_timeout" }); }

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const orderSheet = mktGetSheet_(ss, "market_orders");
      const orderValues = getValuesSafe_(orderSheet);
      if (orderValues.length < 2) return json_({ ok: false, error: "not_found" });

      const oHeader = orderValues[0];
      const oIdx = indexMap_(oHeader);
      const oRows = orderValues.slice(1);

      var orderRowIndex = -1;
      var orderRow = null;
      for (var i = 0; i < oRows.length; i++) {
        if (str_(oRows[i][oIdx["order_id"]]) === orderId) {
          orderRowIndex = i + 2;
          orderRow = oRows[i];
          break;
        }
      }
      if (!orderRow) return json_({ ok: false, error: "not_found" });

      const orderStatus = str_(orderRow[oIdx["status"]]);
      if (orderStatus !== "paid" && orderStatus !== "reserved") {
        return json_({ ok: false, error: "invalid_order_status", status: orderStatus });
      }

      const buyerId = str_(orderRow[oIdx["buyer_id"]]);
      const itemId = str_(orderRow[oIdx["item_id"]]);
      const price = num_(orderRow[oIdx["price"]]);
      const note = str_(body.note) || "admin_refund";
      const now = new Date();

      // 注文ステータス更新
      orderSheet.getRange(orderRowIndex, oIdx["status"] + 1).setValue("refunded");
      orderSheet.getRange(orderRowIndex, oIdx["refunded_at"] + 1).setValue(now);
      orderSheet.getRange(orderRowIndex, oIdx["note"] + 1).setValue(note);
      orderSheet.getRange(orderRowIndex, oIdx["updated_at"] + 1).setValue(now);

      // エスクロー → refunded
      const escrowSheet = mktGetSheet_(ss, "market_escrow");
      const escrowValues = getValuesSafe_(escrowSheet);
      if (escrowValues.length >= 2) {
        const eHeader = escrowValues[0];
        const eIdx = indexMap_(eHeader);
        const eRows = escrowValues.slice(1);
        for (var j = 0; j < eRows.length; j++) {
          if (str_(eRows[j][eIdx["order_id"]]) === orderId &&
              str_(eRows[j][eIdx["state"]]) === "held") {
            escrowSheet.getRange(j + 2, eIdx["state"] + 1).setValue("refunded");
            escrowSheet.getRange(j + 2, eIdx["updated_at"] + 1).setValue(now);
            break;
          }
        }
      }

      // 在庫予約を解放: stock_reserved--
      const itemSheet = mktGetSheet_(ss, "market_items");
      const itemValues = getValuesSafe_(itemSheet);
      if (itemValues.length >= 2) {
        const iHeader = itemValues[0];
        const iIdx = indexMap_(iHeader);
        const iRows = itemValues.slice(1);
        for (var k = 0; k < iRows.length; k++) {
          if (str_(iRows[k][iIdx["item_id"]]) === itemId) {
            const curReserved = num_(iRows[k][iIdx["stock_reserved"]]);
            itemSheet.getRange(k + 2, iIdx["stock_reserved"] + 1).setValue(Math.max(0, curReserved - 1));
            itemSheet.getRange(k + 2, iIdx["updated_at"] + 1).setValue(now);
            break;
          }
        }
      }

      // 買い手に返金
      const buyerUser = mktGetUserByLoginId_(buyerId);
      mktAdjustEp_(buyerId, buyerUser ? buyerUser.email : "", price,
        "market_refund", "order=" + orderId + " item=" + itemId + " note=" + note);

      return json_({ ok: true, order_id: orderId, refunded_amount: price, buyer_id: buyerId });
    } finally {
      lock.releaseLock();
    }
  }

  // =========================================================
  // market_report（通報：重複防止・3件で自動hidden）
  // =========================================================
  if (action === "market_report") {
    const id = str_(body.id);
    const code = str_(body.code);
    if (!id || !code) return json_({ ok: false, error: "missing_auth" });

    const user = mktAuth_(SECRET, id, code);
    if (!user.ok) return json_({ ok: false, error: "auth_failed", reason: user.reason });

    const itemId = str_(body.item_id);
    const reason = str_(body.reason).trim();
    const message = str_(body.message).trim();

    if (!itemId) return json_({ ok: false, error: "missing_item_id" });
    if (!reason) return json_({ ok: false, error: "missing_reason" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportSheet = mktGetSheet_(ss, "market_reports");
    const reportValues = getValuesSafe_(reportSheet);

    // 重複チェック
    if (reportValues.length >= 2) {
      const rHeader = reportValues[0];
      const rIdx = indexMap_(rHeader);
      const rRows = reportValues.slice(1);
      for (var i = 0; i < rRows.length; i++) {
        if (str_(rRows[i][rIdx["item_id"]]) === itemId &&
            str_(rRows[i][rIdx["reporter_id"]]) === user.login_id) {
          return json_({ ok: false, error: "already_reported" });
        }
      }
    }

    const reportId = "RPT_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
    const now = new Date();

    reportSheet.appendRow([
      reportId,       // report_id
      itemId,         // item_id
      user.login_id,  // reporter_id
      reason,         // reason
      message,        // message
      now,            // created_at
    ]);

    // アイテムの report_count を更新し、閾値超えなら hidden に
    const itemSheet = mktGetSheet_(ss, "market_items");
    const itemValues = getValuesSafe_(itemSheet);
    if (itemValues.length >= 2) {
      const iHeader = itemValues[0];
      const iIdx = indexMap_(iHeader);
      const iRows = itemValues.slice(1);
      for (var j = 0; j < iRows.length; j++) {
        if (str_(iRows[j][iIdx["item_id"]]) === itemId) {
          const curCount = num_(iRows[j][iIdx["report_count"]]) + 1;
          itemSheet.getRange(j + 2, iIdx["report_count"] + 1).setValue(curCount);
          itemSheet.getRange(j + 2, iIdx["updated_at"] + 1).setValue(now);
          if (curCount >= MARKET_REPORT_HIDDEN_THRESHOLD_) {
            itemSheet.getRange(j + 2, iIdx["status"] + 1).setValue("hidden");
          }
          break;
        }
      }
    }

    return json_({ ok: true, report_id: reportId });
  }

  return json_({ ok: false, error: "bad_action" });
}

// ==============================
// Market Helper Functions
// ==============================

// シートを取得（無ければヘッダー付きで作成）
function mktGetSheet_(ss, name) {
  const HEADERS = {
    "market_items": [
      "item_id", "seller_id", "seller_name", "title", "desc", "item_type",
      "asset_count", "currency", "price", "fee_rate", "delivery_mode", "delivery_ref",
      "stock_total", "stock_sold", "stock_reserved", "status", "report_count",
      "created_at", "updated_at",
    ],
    "market_orders": [
      "order_id", "item_id", "buyer_id", "seller_id", "currency", "price",
      "fee_amount", "seller_net", "status", "reserved_until", "paid_at",
      "delivered_at", "confirmed_at", "refunded_at", "note", "created_at", "updated_at",
    ],
    "market_escrow": [
      "escrow_id", "order_id", "currency", "hold_amount", "state",
      "created_at", "updated_at",
    ],
    "market_reports": [
      "report_id", "item_id", "reporter_id", "reason", "message", "created_at",
    ],
    "market_daily_limits": [
      "user_id", "date_jst", "listed_count", "updated_at",
    ],
  };
  return getOrCreateSheetByName_(ss, name, HEADERS[name] || []);
}

// market_items 行 → 公開用オブジェクト（delivery_ref は含まない）
function mktRowToItem_(row, idx) {
  const KEYS = [
    "item_id", "seller_id", "seller_name", "title", "desc", "item_type",
    "asset_count", "currency", "price", "fee_rate", "delivery_mode",
    "stock_total", "stock_sold", "stock_reserved", "status", "report_count",
    "created_at", "updated_at",
  ];
  const obj = {};
  KEYS.forEach(function(k) {
    if (idx[k] !== undefined) obj[k] = row[idx[k]];
  });
  return obj;
}

// HMAC-SHA256 認証（login と同仕様）
function mktAuth_(SECRET, id, code) {
  try {
    const sheet = getOrCreateSheet_();
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return { ok: false, reason: "no_data" };

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      const r = rows[i];
      const loginId = str_(r[idx["login_id"]]);
      const email = str_(r[idx["email"]]);
      if (id !== loginId && id !== email) continue;

      const status = str_(r[idx["status"]]);
      if (status !== "approved") return { ok: false, reason: "not_approved" };

      const pwHashSaved = str_(r[idx["pw_hash"]]);
      const pwHashInput = hmacSha256Hex_(SECRET, loginId + ":" + code);
      if (pwHashInput !== pwHashSaved) return { ok: false, reason: "invalid_password" };

      return {
        ok: true,
        login_id: loginId,
        email: email,
        name: idx["name"] !== undefined ? str_(r[idx["name"]]) : "",
        ep_balance: idx["ep_balance"] !== undefined ? num_(r[idx["ep_balance"]]) : 0,
        bp_balance: idx["bp_balance"] !== undefined ? num_(r[idx["bp_balance"]]) : 0,
      };
    }
    return { ok: false, reason: "not_found" };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

// login_id でユーザー情報を取得
function mktGetUserByLoginId_(loginId) {
  try {
    const sheet = getOrCreateSheet_();
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return null;

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        return {
          login_id: loginId,
          email: idx["email"] !== undefined ? str_(rows[i][idx["email"]]) : "",
          ep_balance: idx["ep_balance"] !== undefined ? num_(rows[i][idx["ep_balance"]]) : 0,
          rowIndex: i + 2,
        };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// EP残高を増減し wallet_ledger に記録
function mktAdjustEp_(loginId, email, delta, kind, memo) {
  try {
    const sheet = getOrCreateSheet_();
    const values = getValuesSafe_(sheet);
    if (values.length < 2) return { ok: false, error: "no_data" };

    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["login_id"]]) === loginId) {
        const rowIndex = i + 2;
        const curEp = num_(sheet.getRange(rowIndex, idx["ep_balance"] + 1).getValue());
        const newEp = curEp + delta;
        sheet.getRange(rowIndex, idx["ep_balance"] + 1).setValue(newEp);
        try {
          appendWalletLedger_({
            ts: new Date(),
            kind: kind,
            login_id: loginId,
            email: email || str_(rows[i][idx["email"]]),
            amount: delta,
            memo: memo || "",
          });
        } catch (e2) {}
        return { ok: true, new_balance: newEp };
      }
    }
    return { ok: false, error: "user_not_found" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// JST での今日の日付文字列 "YYYY-MM-DD"
function mktTodayJst_() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

// 当日の出品数を取得
function mktGetDailyListCount_(limitSheet, userId, dateJst) {
  const values = getValuesSafe_(limitSheet);
  if (values.length < 2) return 0;

  const header = values[0];
  const idx = indexMap_(header);
  const rows = values.slice(1);

  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i][idx["user_id"]]) === userId &&
        str_(rows[i][idx["date_jst"]]) === dateJst) {
      return num_(rows[i][idx["listed_count"]]);
    }
  }
  return 0;
}

// 当日の出品数をインクリメント（行が無ければ新規追加）
function mktIncrDailyListCount_(limitSheet, userId, dateJst) {
  const values = getValuesSafe_(limitSheet);
  const now = new Date();

  if (values.length >= 2) {
    const header = values[0];
    const idx = indexMap_(header);
    const rows = values.slice(1);

    for (var i = 0; i < rows.length; i++) {
      if (str_(rows[i][idx["user_id"]]) === userId &&
          str_(rows[i][idx["date_jst"]]) === dateJst) {
        const rowIndex = i + 2;
        const curCount = num_(rows[i][idx["listed_count"]]);
        limitSheet.getRange(rowIndex, idx["listed_count"] + 1).setValue(curCount + 1);
        limitSheet.getRange(rowIndex, idx["updated_at"] + 1).setValue(now);
        return;
      }
    }
  }

  // 新規行
  limitSheet.appendRow([userId, dateJst, 1, now]);
}

// ============================================
// 売却申請・BP付与 関連（追記）
// ============================================

// SellRequestsシート取得（なければ作成）
function getSellRequestsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('SellRequests');
  if (!sheet) {
    sheet = ss.insertSheet('SellRequests');
    sheet.appendRow(['request_id','item_id','seller_id','status','bp_amount','requested_at','granted_at']);
  }
  return sheet;
}

// PendingBPシート取得（なければ作成）
function getPendingBPSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('PendingBP');
  if (!sheet) {
    sheet = ss.insertSheet('PendingBP');
    sheet.appendRow(['user_id','bp_amount','created_at','claimed']);
  }
  return sheet;
}

// 1. 売却申請
function handle_sell_request_(data) {
  const item_id = str_(data.item_id);
  const seller_id = str_(data.seller_id);
  if (!item_id || !seller_id) return { ok: false, error: 'missing params' };
  const sheet = getSellRequestsSheet_();
  const request_id = 'sr_' + new Date().getTime();
  sheet.appendRow([request_id, item_id, seller_id, 'pending', '', new Date().toISOString(), '']);
  return { ok: true, request_id: request_id };
}

// 2. 申請一覧取得（admin用）
function handle_get_sell_requests_(data) {
  const sheet = getSellRequestsSheet_();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const result = rows.slice(1).map(function(r) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = r[i]; });
    return obj;
  });
  return { ok: true, requests: result };
}

// 3. BP付与（admin用）
function handle_grant_bp_for_sell_(data) {
  const request_id = str_(data.request_id);
  const user_id = str_(data.user_id);
  const bp_amount = num_(data.bp_amount);
  if (!request_id || !user_id || !bp_amount) return { ok: false, error: 'missing params' };

  // SellRequestsのステータス更新
  const sheet = getSellRequestsSheet_();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (str_(rows[i][0]) === request_id) {
      sheet.getRange(i + 1, 4).setValue('granted');
      sheet.getRange(i + 1, 5).setValue(bp_amount);
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      break;
    }
  }

  // PendingBPに追加
  const pendingSheet = getPendingBPSheet_();
  pendingSheet.appendRow([user_id, bp_amount, new Date().toISOString(), false]);

  return { ok: true };
}

// 4. 未受取BP確認
function handle_get_pending_bp_(data) {
  const user_id = str_(data.user_id || data.id);
  if (!user_id) return { ok: false, error: 'missing user_id' };
  const sheet = getPendingBPSheet_();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(user_id) && rows[i][3] === false) {
      return { ok: true, hasPending: true, amount: rows[i][1] };
    }
  }
  return { ok: true, hasPending: false, amount: 0 };
}

// 5. BP受取完了
function handle_claim_pending_bp_(data) {
  const user_id = str_(data.user_id || data.id);
  if (!user_id) return { ok: false, error: 'missing user_id' };
  const sheet = getPendingBPSheet_();
  const rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(user_id) && rows[i][3] === false) {
      sheet.getRange(i + 1, 4).setValue(true);
      break;
    }
  }
  return { ok: true };
}

// ---- doPost 再定義（sell_request 系アクションを追加ルーティング）----
// ✅ market_ は引き続き handleMarket_ へ、新規アクションを追加、既存は handle_ へ
function doPost(e) {
  try {
    const key = pickKey_(e);
    const body = JSON.parse(e?.postData?.contents || "{}");
    const action = str_(body.action);
    if (action && action.startsWith("market_")) {
      return handleMarket_(key, body);
    }
    if (action === 'sell_request')      return json_(handle_sell_request_(body));
    if (action === 'get_sell_requests') return json_(handle_get_sell_requests_(body));
    if (action === 'grant_bp_for_sell') return json_(handle_grant_bp_for_sell_(body)); // ✅ 追記
    if (action === 'get_pending_bp')    return json_(handle_get_pending_bp_(body));
    if (action === 'claim_pending_bp')  return json_(handle_claim_pending_bp_(body));
    return handle_(key, body);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---- market_list seller_id フィルター（handleMarket_ 内 market_list の filtered 後に相当する処理を独立関数で提供）----
// ✅ filtered は const のため再代入不可。market_listのGET側でseller_idを渡す場合はクエリで絞る
// ✅ doGet 再定義でseller_idをbodyに渡すよう追記
function doGet(e) {
  try {
    const key = pickKey_(e);
    const action = str_(e?.parameter?.action);

    if (!action) {
      return json_({ ok: false, error: "method_not_allowed" });
    }

    if (action.startsWith("market_")) {
      const body = {
        action,
        id: str_(e?.parameter?.id),
        code: str_(e?.parameter?.code),
        item_id: str_(e?.parameter?.item_id),
        order_id: str_(e?.parameter?.order_id),
        reason: str_(e?.parameter?.reason),
        message: str_(e?.parameter?.message),
        status: str_(e?.parameter?.status),
        item_type: str_(e?.parameter?.item_type),
        currency: str_(e?.parameter?.currency),
        page: str_(e?.parameter?.page),
        limit: str_(e?.parameter?.limit),
        adminKey: str_(e?.parameter?.adminKey),
        note: str_(e?.parameter?.note),
        seller_id: str_(e?.parameter?.seller_id),
      };
      return handleMarket_(key, body);
    }

    if (action === 'get_sell_requests') return json_(handle_get_sell_requests_({}));
    if (action === 'get_pending_bp')    return json_(handle_get_pending_bp_({ id: str_(e?.parameter?.id) }));

    const pseudoBody = {
      action,
      adminKey: str_(e?.parameter?.adminKey),
      rowIndex: num_(e?.parameter?.rowIndex),
      id: str_(e?.parameter?.id),
      code: str_(e?.parameter?.code),
      plan: str_(e?.parameter?.plan),
      email: str_(e?.parameter?.email),
      name: str_(e?.parameter?.name),
      nameKana: str_(e?.parameter?.nameKana),
      discordId: str_(e?.parameter?.discordId),
      ageBand: str_(e?.parameter?.ageBand),
      prefecture: str_(e?.parameter?.prefecture),
      city: str_(e?.parameter?.city),
      job: str_(e?.parameter?.job),
      refName: str_(e?.parameter?.refName),
      refId: str_(e?.parameter?.refId),
      refCode: str_(e?.parameter?.refCode),
      region: str_(e?.parameter?.region),
      applyId: str_(e?.parameter?.applyId),
      orderId: str_(e?.parameter?.orderId),
      paymentStatus: str_(e?.parameter?.paymentStatus),
      isPaid: str_(e?.parameter?.isPaid),
      invoiceId: str_(e?.parameter?.invoiceId),
      actuallyPaid: str_(e?.parameter?.actuallyPaid),
      payAmount: str_(e?.parameter?.payAmount),
      payCurrency: str_(e?.parameter?.payCurrency),
      priceAmount: str_(e?.parameter?.priceAmount),
      priceCurrency: str_(e?.parameter?.priceCurrency),
      token: str_(e?.parameter?.token),
      password: str_(e?.parameter?.password),
    };

    return handle_(key, pseudoBody);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ✅ market_list の seller_id フィルターは handleMarket_ 側の対応待ち

/**
 * 手動実行用：approved かつ reset_sent_at が空のユーザーを全員再送
 * GASエディタから直接実行する
 */
function __rescueAllPendingMail() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('applies');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = indexMap_(headers);

  const col = (name) => headers.indexOf(name);
  let sent = 0, skipped = 0, failed = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[col('status')];
    const email = row[col('email')];
    const resetSentAt = row[col('reset_sent_at')];
    const pwHash = row[col('pw_hash')];

    if (status === 'approved' && !resetSentAt && !pwHash && email) {
      Logger.log('[rescue] 対象: row=' + (i+1) + ' email=' + email);
      try {
        approveRowCore_(sheet, headers, idx, i + 1, 'rescue_resend');
        Logger.log('[rescue] 送信成功: ' + email);
        sent++;
        Utilities.sleep(1500);
      } catch(e) {
        Logger.log('[rescue] 送信失敗: ' + email + ' / ' + e);
        failed++;
      }
    } else {
      skipped++;
    }
  }

  Logger.log('[rescue] 完了 sent=' + sent + ' failed=' + failed + ' skipped=' + skipped);
}
// doGet から seller_id をbodyに含めて渡しているため、GAS側でフィルター対応後に自動で有効になる