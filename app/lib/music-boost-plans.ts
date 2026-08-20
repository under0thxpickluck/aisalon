// app/lib/music-boost-plans.ts
//
// Music Boost のプラン定義（唯一の情報源）。
// 参照元: app/music-boost/page.tsx（ユーザー画面）
//         app/api/admin/subscriptions/route.ts（財務管理のサブスク一覧）
//
// price = 月額（円・税込 / Square の請求額と一致させること）
// ep    = EP決済時の必要EP数（円価格とは連動しない固定値。EP決済は現在休止中だが自動更新で使用）
//
// ⚠️ gas/Code.gs の MUSIC_BOOST_PLANS とは自動同期されない。
//    価格を変えるときは GAS 側も同じ値に手で合わせること。

export type MusicBoostPlan = {
  id: string;
  label: string;
  percent: number;
  price: number;
  ep: number;
  slots: number;
  color: string;
  recommend: string;
  squareUrl: string;
};

export const MUSIC_BOOST_PLANS: MusicBoostPlan[] = [
  { id: "starter",  label: "Starter",  percent: 2,  price: 1440,   ep: 900,    slots: 10,  color: "from-gray-600 to-gray-500",     recommend: "推奨：8曲以上配信済みの方",   squareUrl: "https://square.link/u/Z8JfMUyE" },
  { id: "light",    label: "Light",    percent: 5,  price: 4640,   ep: 2900,   slots: 25,  color: "from-blue-700 to-blue-500",     recommend: "推奨：16曲以上配信済みの方",  squareUrl: "https://square.link/u/a3n7mj8b" },
  { id: "basic",    label: "Basic",    percent: 10, price: 9440,   ep: 5900,   slots: 50,  color: "from-green-700 to-green-500",   recommend: "推奨：30曲以上配信済みの方",  squareUrl: "https://square.link/u/AknPSYzR" },
  { id: "growth",   label: "Growth",   percent: 15, price: 15840,  ep: 9900,   slots: 75,  color: "from-teal-700 to-teal-500",     recommend: "推奨：50曲以上配信済みの方",  squareUrl: "https://square.link/u/0Tl1BZwU" },
  { id: "pro",      label: "Pro",      percent: 20, price: 23840,  ep: 14900,  slots: 100, color: "from-purple-700 to-purple-500", recommend: "推奨：75曲以上配信済みの方",  squareUrl: "https://square.link/u/6EQ6FZPS" },
  { id: "advanced", label: "Advanced", percent: 25, price: 31840,  ep: 19900,  slots: 125, color: "from-indigo-700 to-indigo-500", recommend: "推奨：100曲以上配信済みの方", squareUrl: "https://square.link/u/yXfPqP2m" },
  { id: "premium",  label: "Premium",  percent: 30, price: 47840,  ep: 29900,  slots: 150, color: "from-pink-700 to-pink-500",     recommend: "推奨：150曲以上配信済みの方", squareUrl: "https://square.link/u/f19KQa9n" },
  { id: "elite",    label: "Elite",    percent: 35, price: 79840,  ep: 49900,  slots: 175, color: "from-orange-700 to-orange-500", recommend: "推奨：200曲以上配信済みの方", squareUrl: "https://square.link/u/n532LqZd" },
  { id: "master",   label: "Master",   percent: 40, price: 111840, ep: 69900,  slots: 200, color: "from-red-700 to-red-500",       recommend: "推奨：300曲以上配信済みの方", squareUrl: "https://square.link/u/GRD64dbi" },
  { id: "legend",   label: "Legend",   percent: 45, price: 160000, ep: 100000, slots: 225, color: "from-yellow-600 to-yellow-400", recommend: "推奨：500曲以上配信済みの方", squareUrl: "https://square.link/u/PX68xQhf" },
];

export function findMusicBoostPlan(planId: string): MusicBoostPlan | undefined {
  return MUSIC_BOOST_PLANS.find(p => p.id === planId);
}
