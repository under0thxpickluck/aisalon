"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, getAuthSecret } from "../../lib/auth";
import { useLifaiCat } from "@/components/LifaiCat";

const ITEM_TYPES = [
  { value: "image_pack", label: "🖼️ 画像パック", minAsset: 100, assetUnit: "枚" },
  { value: "music_pack", label: "🎵 音楽パック", minAsset: 10,  assetUnit: "曲" },
  { value: "other_pack", label: "📦 その他",     minAsset: 0,   assetUnit: "" },
];

export default function MarketCreatePage() {
  const router = useRouter();
  const { trackEvent } = useLifaiCat();
  const [myId, setMyId]   = useState("");
  const [myCode, setMyCode] = useState("");
  const [epBalance, setEpBalance] = useState<number | null>(null);

  const [title, setTitle]             = useState("");
  const [desc, setDesc]               = useState("");
  const [itemType, setItemType]       = useState("image_pack");
  const [assetCount, setAssetCount]   = useState<number | "">(100);
  const [currency, setCurrency]       = useState("EP");
  const [price, setPrice]             = useState<number | "">(50);
  const [stockTotal, setStockTotal]   = useState<number | "">(1);
  const [deliveryMode, setDeliveryMode] = useState("link");
  const [deliveryRef, setDeliveryRef] = useState("");
  const [previewImages, setPreviewImages] = useState<string[]>([""]);

  const addPreviewImage = () => {
    if (previewImages.length >= 8) return;
    setPreviewImages(prev => [...prev, ""]);
  };
  const removePreviewImage = (idx: number) => {
    setPreviewImages(prev => prev.filter((_, i) => i !== idx));
  };
  const updatePreviewImage = (idx: number, val: string) => {
    setPreviewImages(prev => prev.map((v, i) => i === idx ? val : v));
  };

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState(false);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) { router.replace("/login"); return; }
    const id =
      (auth as any)?.id || (auth as any)?.loginId ||
      (auth as any)?.login_id || (auth as any)?.email || "";
    const code = getAuthSecret() || (auth as any)?.token || "";
    setMyId(id);
    setMyCode(code);
    trackEvent("page_view", { page_id: "market_create" });
  }, [router, trackEvent]);

  // EP残高取得
  useEffect(() => {
    if (!myId || !myCode) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/wallet/balance?id=${encodeURIComponent(myId)}&code=${encodeURIComponent(myCode)}&group=${encodeURIComponent((() => { try { const a = JSON.parse(localStorage.getItem("addval_auth_v1") || "{}"); return a?.group || ""; } catch { return ""; } })())}`
        );
        const data = await res.json().catch(() => ({}));
        if (data.ok && typeof data.ep === "number") {
          setEpBalance(data.ep);
        }
      } catch {
        // silently fail — EP lock won't apply
      }
    })();
  }, [myId, myCode]);

  // EP残高 < 1 のときに EP を選んでいたら BP に切り替え
  const epLocked = epBalance !== null && epBalance < 1;
  useEffect(() => {
    if (epLocked && currency === "EP") {
      setCurrency("BP");
    }
  }, [epLocked, currency]);

  const selectedType = ITEM_TYPES.find(t => t.value === itemType) ?? ITEM_TYPES[0];
  const isOtherPack = itemType === "other_pack";

  const validate = (): string => {
    if (!title.trim()) return "タイトルを入力してください";
    if (Number(price) < 50) return "価格は50以上で設定してください";
    if (!isOtherPack && Number(assetCount) < selectedType.minAsset) {
      return `アセット数は${selectedType.minAsset}${selectedType.assetUnit}以上で設定してください`;
    }
    if (Number(stockTotal) < 1) return "在庫数は1以上で設定してください";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    if (!myId || !myCode) { setError("ログインが必要です"); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/market/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: myId,
          code: myCode,
          title: title.trim(),
          desc: desc.trim(),
          item_type: itemType,
          asset_count: Number(assetCount),
          currency,
          price: Number(price),
          delivery_mode: deliveryMode,
          delivery_ref: deliveryRef.trim(),
          stock_total: Number(stockTotal),
          preview_images: previewImages.filter(u => u.trim() !== ""),
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setError(data.gas?.error || data.error || "出品に失敗しました");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/market"), 1500);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Styles ──
  const inputStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    padding: "10px 14px",
    fontSize: 13,
    color: "#EAF0FF",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(234,240,255,0.55)",
    letterSpacing: "0.04em",
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0B1220", color: "#EAF0FF" }}>
      {/* Radial glow */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: -10,
        pointerEvents: "none",
        background: [
          "radial-gradient(ellipse 800px 500px at 15% -10%, rgba(99,102,241,0.18) 0%, transparent 60%)",
          "radial-gradient(ellipse 600px 400px at 85% 0%, rgba(124,58,237,0.12) 0%, transparent 55%)",
        ].join(","),
      }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{
          background: "#0F1A2E",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28,
          padding: 24,
          boxShadow: "0 26px 70px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/market"
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(234,240,255,0.65)",
                textDecoration: "none",
              }}
            >
              ← 戻る
            </Link>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 9999,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(234,240,255,0.55)",
            }}>
              ＋ 出品
            </div>
          </div>

          <h1 style={{ marginTop: 24, fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", color: "#EAF0FF" }}>
            出品フォーム
          </h1>
          <p style={{ marginTop: 4, fontSize: 12, color: "rgba(234,240,255,0.45)" }}>
            1日5件まで。価格は通貨単位で50以上。売上から5.5%の手数料が差し引かれます。
          </p>
          {/* 利用規約・注意事項 */}
          <div style={{
            marginTop: 16,
            borderRadius: 14,
            border: "1px solid rgba(167,139,250,0.2)",
            background: "rgba(124,58,237,0.06)",
            padding: "12px 14px",
            fontSize: 10,
            color: "rgba(167,139,250,0.75)",
            lineHeight: 1.8,
          }}>
            <p style={{ fontWeight: 700, marginBottom: 4, color: "rgba(167,139,250,0.9)" }}>⚠ 出品ルール・禁止事項</p>
            <p>・EP（Exchangeポイント）/BPは現金化・外部移転・ユーザー間直接送金はできません</p>
            <p>・著作権を侵害するコンテンツの出品は禁止です</p>
            <p>・外部でのポイント売買・換金行為は永久BAN対象です</p>
            <p>・初回出品は審査が入る場合があります</p>
          </div>

          {success ? (
            <div style={{
              marginTop: 32,
              borderRadius: 20,
              border: "1px solid rgba(16,185,129,0.25)",
              background: "rgba(16,185,129,0.08)",
              padding: "32px 16px",
              textAlign: "center",
            }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#6EE7B7" }}>✅ 出品しました！</p>
              <p style={{ marginTop: 4, fontSize: 12, color: "rgba(110,231,183,0.6)" }}>
                マーケットページに移動します…
              </p>
            </div>
          ) : (
            <form id="create-form" onSubmit={handleSubmit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>

              {/* タイトル */}
              <div>
                <label style={labelStyle}>タイトル *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="例：AI生成アニメ画像100枚セット"
                  required
                  style={inputStyle}
                />
              </div>

              {/* 説明 */}
              <div>
                <label style={labelStyle}>説明</label>
                <textarea
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="商品の内容・使用条件・注意事項など"
                  rows={4}
                  style={{ ...inputStyle, resize: "none" }}
                />
              </div>

              {/* タイプ */}
              <div>
                <label style={labelStyle}>商品タイプ *</label>
                <select
                  value={itemType}
                  onChange={e => {
                    setItemType(e.target.value);
                    const t = ITEM_TYPES.find(x => x.value === e.target.value);
                    if (t) setAssetCount(t.minAsset > 0 ? t.minAsset : "");
                  }}
                  style={inputStyle}
                >
                  {ITEM_TYPES.map(t => (
                    <option key={t.value} value={t.value} style={{ background: "#0F1A2E" }}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* アセット数 */}
              <div>
                <label style={labelStyle}>
                  {isOtherPack
                    ? "アセット数（任意）"
                    : `アセット数（最低 ${selectedType.minAsset}${selectedType.assetUnit}）*`}
                </label>
                <input
                  type="number"
                  value={assetCount}
                  onChange={e => setAssetCount(e.target.value === "" ? "" : Number(e.target.value))}
                  min={isOtherPack ? 0 : selectedType.minAsset}
                  required={!isOtherPack}
                  style={inputStyle}
                />
              </div>

              {/* 通貨・価格 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>通貨 *</label>
                  <select
                    value={currency}
                    onChange={e => {
                      if (e.target.value === "EP" && epLocked) return;
                      setCurrency(e.target.value);
                    }}
                    style={inputStyle}
                  >
                    <option
                      value="EP"
                      disabled={epLocked}
                      style={{ background: "#0F1A2E", opacity: epLocked ? 0.4 : 1 }}
                    >
                      EP{epLocked ? " 🔒" : ""}
                    </option>
                    <option value="BP" style={{ background: "#0F1A2E" }}>BP</option>
                  </select>
                  {epLocked && (
                    <p style={{ marginTop: 5, fontSize: 10, color: "#FCD34D", lineHeight: 1.5 }}>
                      ランクまたは会員期間7日以上で解放されます
                    </p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>価格（最低50）*</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    min={50}
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* 在庫数 */}
              <div>
                <label style={labelStyle}>在庫数 *</label>
                <input
                  type="number"
                  value={stockTotal}
                  onChange={e => setStockTotal(e.target.value === "" ? "" : Number(e.target.value))}
                  min={1}
                  required
                  style={inputStyle}
                />
              </div>

              {/* 納品方法 */}
              <div>
                <label style={labelStyle}>納品方法 *</label>
                <select
                  value={deliveryMode}
                  onChange={e => setDeliveryMode(e.target.value)}
                  style={inputStyle}
                >
                  <option value="link" style={{ background: "#0F1A2E" }}>リンク（URL）</option>
                  <option value="download" style={{ background: "#0F1A2E" }}>ダウンロード</option>
                </select>
              </div>

              {/* 納品URL */}
              <div>
                <label style={labelStyle}>
                  納品URL（非公開・購入者への参照用）
                </label>
                <input
                  type="url"
                  value={deliveryRef}
                  onChange={e => setDeliveryRef(e.target.value)}
                  placeholder="GigaFile便のURL、Google DriveのURLなど"
                  style={inputStyle}
                />
                <p style={{ marginTop: 5, fontSize: 10, color: "rgba(234,240,255,0.3)", lineHeight: 1.5 }}>
                  ※ 公開されません。管理目的で保管されます。
                </p>
                <p style={{ marginTop: 3, fontSize: 10, color: "rgba(252,211,77,0.7)", lineHeight: 1.5 }}>
                  ※ GigaFile便など期限付きURLの場合は購入者が早めにダウンロードするよう案内してください。
                </p>
              </div>

              {/* プレビュー画像 */}
              <div>
                <label style={labelStyle}>プレビュー画像URL（任意・最大8枚）</label>
                <p style={{ marginTop: 3, marginBottom: 8, fontSize: 10, color: "rgba(234,240,255,0.3)", lineHeight: 1.5 }}>
                  ※ 購入者がコンテンツを確認するためのサンプル画像URLを入力してください。
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {previewImages.map((url, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8 }}>
                      <input
                        type="url"
                        value={url}
                        onChange={e => updatePreviewImage(idx, e.target.value)}
                        placeholder={`画像URL ${idx + 1}`}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      {previewImages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePreviewImage(idx)}
                          style={{
                            flexShrink: 0,
                            borderRadius: 12,
                            border: "1px solid rgba(239,68,68,0.3)",
                            background: "rgba(239,68,68,0.08)",
                            padding: "8px 12px",
                            fontSize: 12,
                            color: "#FCA5A5",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {previewImages.length < 8 && (
                    <button
                      type="button"
                      onClick={addPreviewImage}
                      style={{
                        borderRadius: 14,
                        border: "1px dashed rgba(99,102,241,0.4)",
                        background: "transparent",
                        padding: "8px",
                        fontSize: 12,
                        color: "rgba(167,139,250,0.7)",
                        cursor: "pointer",
                      }}
                    >
                      ＋ 画像を追加（{previewImages.length}/8）
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div style={{
                  borderRadius: 16,
                  border: "1px solid rgba(239,68,68,0.25)",
                  background: "rgba(239,68,68,0.08)",
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#FCA5A5",
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
                  borderRadius: 16,
                  background: submitting
                    ? "rgba(99,102,241,0.35)"
                    : "linear-gradient(90deg,#6366F1,#A78BFA)",
                  padding: "13px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                  boxShadow: submitting ? "none" : "0 4px 20px rgba(99,102,241,0.35)",
                  transition: "opacity 0.15s, box-shadow 0.15s",
                }}
                className="active:scale-[0.98]"
              >
                {submitting ? "出品中…" : "出品する"}
              </button>
            </form>
          )}
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "rgba(234,240,255,0.2)" }}>© LIFAI</div>
      </div>
    </main>
  );
}
