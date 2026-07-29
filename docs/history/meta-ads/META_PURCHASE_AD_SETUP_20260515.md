# Your Love Element - Purchase Objective Ad Setup

建立日期：2026-05-15

## 目前狀態

Traffic / Landing Page View 廣告已開始正常消耗，目前網頁點擊成本約 `NT$5`。這代表廣告帳戶、Page、付款、投遞管線大致恢復正常。

下一步不是修改現有 Traffic 廣告，而是另開一個乾淨的 `Sales / Purchase` 廣告，用同一套 Business、Ad account、Page、Pixel/Dataset、Domain，避免看起來像規避限制。

## 建議策略

- 保留目前 Traffic 廣告，不要立刻關掉。
- 新增一個 Sales campaign，目標事件用 `Purchase`。
- 第一波只開 1 個 ad set、1 支 ad。
- 不使用 interests，不使用 cost cap，不使用 bid cap。
- 先讓 Purchase campaign 自己找到購買人群，不要把 Traffic 的點擊成本直接當 CPA 預期。

如果總預算有限：

```text
Traffic campaign: NT$150-300/day
Purchase campaign: NT$500/day
```

如果總預算可以承受：

```text
Traffic campaign: keep current budget
Purchase campaign: NT$800-1000/day
```

## Campaign

```text
Campaign name: YLE_Meta_USEN_LR-Purchase_20260515
Objective: Sales
Buying type: Auction
Conversion location: Website
Dataset / Pixel: Your Love Element
Conversion event: Purchase
Performance goal: Maximize number of conversions
Budget type: Daily
Daily budget: NT$500 first, NT$800-1000 only if you are comfortable with faster learning
Bid strategy: Highest volume
Cost per result goal: None
Schedule: Start at the next clean full hour in the ad account timezone
```

Keep off:

```text
Cost cap: Off
Bid cap: Off
ROAS goal: Off
Meta AI image generation: Off
Text improvement / rewriting: Off
Translation: Off
Creative enhancement: Off for first test
```

## Ad Set

```text
Ad set name: USEN_Broad_25-54_Purchase_NoInterests
Location: United States
Age: 25-54
Gender: All
Language: English
Detailed targeting: None
Placements: Advantage+ placements
Optimization event: Purchase
Attribution setting: Account default
Audience exclusions: Purchasers only, if a clean purchaser audience exists
```

不要加這些 interests：

```text
Dating
Relationship
Tarot
Astrology
Spirituality
Psychic
Soulmate
```

第一波先讓 Meta 用 broad + Purchase event 學習。

## Ad

素材：

```text
assets/meta-low-risk/hq-a-element-profile-feed.png
```

Meta 欄位：

```text
Ad name: LR_PUR_A_ElementProfile_Feed_20260515
Primary text: Take a 10-question Five Element-inspired relationship reflection. Preview a personalized element profile for free, then choose whether to unlock the optional $9.99 report delivered by email.
Headline: Preview your love element
Description: Free preview. Optional report.
CTA: Learn More
URL: https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_purchase_relaunch&utm_content=pur_a_element_profile&utm_term=broad
```

## Columns To Watch

在 Ads Manager 建議看這些欄位：

```text
Amount spent
Impressions
Reach
CPM
Link clicks
CPC (link click)
Landing page views
Cost per landing page view
ViewContent
quiz_start
preview_revealed
InitiateCheckout
checkout_created
Purchase
Cost per Purchase
Purchase conversion value
ROAS
```

## 判讀節奏

發布後 2 到 4 小時：

- 只看是否有 impressions 和 spend。
- 如果 0 impressions，不要改文案，先查 Account Quality、付款、Ad set diagnostics。

發布後 12 到 24 小時：

- 看 Landing Page Views、preview_revealed、InitiateCheckout。
- 如果有點擊但沒有 preview，問題比較可能在 landing page / quiz friction。
- 如果有 preview 但沒有 checkout，問題比較可能在 offer / price / report trust。

發布後 72 小時：

- 才開始看 Purchase 和 CPA。
- 不要在前 24 小時內一直改 active ad。

## 何時調整

可以保留：

- 有正常 spend。
- 有 landing page views。
- 有 `preview_revealed` 或 `InitiateCheckout`。

可以 duplicate 測 `InitiateCheckout` optimization：

- Purchase campaign 有正常 spend。
- 72 小時後完全沒有 Purchase。
- 但有穩定 preview 或 checkout 行為。

可以暫停：

- Spend 超過 `2-3x` 可接受 CPA，仍完全沒有 checkout signal。
- CTR 很低且 Landing Page View 成本明顯惡化。
- Meta 出現新的 Account Quality / policy warning。

## 參考

- Meta Sales objective is for finding people likely to purchase on website: https://www.facebook.com/business/ads/ad-objectives/sales
- Meta Traffic objective is for clicks / landing page traffic, while measurable sales actions should use conversion optimization: https://www.facebook.com/business/ads/ad-objectives/traffic
- Meta Conversions API helps optimize and measure later customer journey events such as Purchase: https://www.facebook.com/business/help/AboutConversionsAPI
