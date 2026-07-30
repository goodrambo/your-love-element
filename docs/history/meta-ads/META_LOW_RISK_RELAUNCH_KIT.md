# Your Love Element - Meta 低風險重新投放配置

最後更新：2026-05-14

## 目標

在「商家資產管理組合」和廣告帳號恢復正常後，用最低風險的方式重新開始投放。這份配置優先解決三件事：

- 確認 Meta 資產真的可以重新花費。
- 避免被系統誤判成 dating、matchmaking、成人曖昧、占卜承諾、情緒弱點利用或規避審核。
- 先用乾淨素材恢復帳戶信任，再逐步測 CPA。

投放文案維持英文，因為目前 landing page 是英文。

## 低風險定位

對外說法使用：

- reflective relationship self-insight
- Five Element-inspired element profile
- free preview
- optional digital report
- delivered by email
- personal insight and entertainment

第一波不要使用：

- future partner、soulmate、twin flame、destiny、find the one
- predict、exact timing、guaranteed love
- Are you single?、still healing?、tired of mixed signals?
- dating、matchmaking、partner-finding service
- therapy、diagnosis、mental health、attachment diagnosis
- 玫瑰、愛心封蠟、燭光、星盤、塔羅、月亮、人物肖像
- Meta AI creative enhancement、文字改寫、翻譯、自動生成背景
- 新 Business Manager、新廣告帳戶、新 Pixel、新網域

## 素材檔案

高質感低風險最終投放圖：

```text
assets/meta-low-risk/hq-a-element-profile-feed.png
assets/meta-low-risk/hq-b-preview-first-feed.png
assets/meta-low-risk/hq-c-email-delivery-story.png
```

背景原圖：

```text
assets/meta-low-risk/hires-a-element-profile-background.png
assets/meta-low-risk/hires-b-report-preview-background.png
assets/meta-low-risk/hires-c-email-delivery-background.png
```

渲染腳本：

```text
assets/meta-low-risk/render_high_quality_ads.py
```

建議使用順序：

1. 先只投 `hq-a-element-profile-feed.png`。
2. 有正常曝光和花費後，再加 `hq-b-preview-first-feed.png`。
3. `hq-c-email-delivery-story.png` 用於 Stories/Reels 或需要強化「email delivery / optional report」時。

## Phase 1：Delivery Check

目的不是看轉換，而是確認恢復後能不能正常曝光和花費。

Campaign：

```text
Name: YLE_Meta_USEN_LR-DeliveryCheck_Traffic_20260514
Objective: Traffic
Destination: Website
Performance goal: Maximize landing page views
Budget type: Daily
Daily budget: NT$300-500
Bid strategy: Highest volume / automatic
Schedule: Start at the next clean full hour in the ad account timezone
```

Ad set：

```text
Name: USEN_Broad_25-54_LPV_NoInterests
Location: United States
Age: 25-54
Gender: All
Language: English
Detailed targeting: None
Placements: Advantage+ placements
Optimization: Landing page views
```

判讀：

- 前 2 到 4 小時只看 impressions 和 spend。
- 如果仍然 0 impressions，先查 Account Quality、Page status、Ad account status、Payment、Account spending limit。
- 如果能花費，跑 12 到 24 小時即可，不要急著判斷 CPA。

## Phase 2：Low-Risk Sales Test

確認能正常花費後，再切到 Purchase 測試。

Campaign：

```text
Name: YLE_Meta_USEN_LR-Sales_20260514
Objective: Sales
Conversion location: Website
Dataset: Your Love Element
Conversion event: Purchase
Performance goal: Maximize number of conversions
Budget type: Daily
Daily budget: NT$500-1000
Bid strategy: Highest volume / automatic
Cost per result goal: None
Attribution: Account default
```

Ad set：

```text
Name: USEN_Broad_25-54_Purchase_NoInterests
Location: United States
Age: 25-54
Gender: All
Language: English
Detailed targeting: None
Custom audiences: None for first cold test
Exclusions: Purchasers only, if a clean purchaser audience exists
Placements: Advantage+ placements
Optimization event: Purchase
```

如果 Purchase 可以曝光但明顯不出轉換，再複製一個 ad set 測：

```text
Name: USEN_Broad_25-54_InitiateCheckout_NoInterests
Optimization event: InitiateCheckout
```

不要一直修改同一個 active ad set。需要改 optimization event 時，用 duplicate。

## Ad A：Element Profile Preview

第一支先投這個。

素材：

```text
assets/meta-low-risk/hq-a-element-profile-feed.png
```

Meta 欄位：

```text
Ad name: LR_A_ElementProfile_Feed_20260514
Primary text: Take a 10-question Five Element-inspired relationship reflection. Preview a personalized element profile for free, then choose whether to unlock the optional $9.99 report delivered by email.
Headline: Preview your love element
Description: Free preview. Optional report.
CTA: Learn More
URL: https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_low_risk_relaunch&utm_content=lr_a_element_profile&utm_term=broad
```

## Ad B：Preview First

Ad A 有正常花費後再加。

素材：

```text
assets/meta-low-risk/hq-b-preview-first-feed.png
```

Meta 欄位：

```text
Ad name: LR_B_PreviewFirst_Feed_20260514
Primary text: Your Love Element turns a short reflection into a simple element profile and optional deeper report. Start with the free preview before checkout.
Headline: Start with a free preview
Description: Optional full report by email.
CTA: Learn More
URL: https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_low_risk_relaunch&utm_content=lr_b_preview_first&utm_term=broad
```

## Ad C：Email Delivery Clarity

適合 Stories/Reels，也可以在留言或點擊行為顯示「使用者不清楚怎麼交付」時加入。

素材：

```text
assets/meta-low-risk/hq-c-email-delivery-story.png
```

Meta 欄位：

```text
Ad name: LR_C_EmailDelivery_Story_20260514
Primary text: Answer 10 questions, see a free element preview, and unlock the full digital report only if it feels useful. The optional report is $9.99 and delivered by email.
Headline: Free preview first
Description: Full report is optional.
CTA: Learn More
URL: https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_low_risk_relaunch&utm_content=lr_c_email_delivery&utm_term=broad
```

## Retargeting 文案

不要一開始就開。等網站有乾淨流量後再用。

```text
Ad name: LR_RT_OptionalReport_20260514
Primary text: The free preview is available first. If the full element report feels useful, unlock the optional $9.99 version and receive it by email.
Headline: Optional full report
Description: Delivered by email.
CTA: Learn More
URL: https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_low_risk_retargeting&utm_content=lr_rt_optional_report&utm_term=retargeting
```

## Landing Page 建議補強

建議在 offer 或 FAQ 附近保留這句英文 disclaimer：

```text
Your Love Element is for personal insight and entertainment. It is not a dating, matchmaking, medical, psychological, legal, financial, or professional advice service.
```

Landing page 必須清楚可見：

- Contact
- Privacy
- Terms
- Refunds
- $9.99 price before checkout
- free preview before paid report
- email delivery expectation

## 發布前檢查

發布前確認：

- Account Quality 沒有 active restriction。
- Business portfolio、Ad account、Page、Pixel/Dataset、Domain 都用原本恢復的那套。
- Payment method 正常，account spending limit 沒有到頂。
- Page 和 IG 有基本品牌內容，不要像空殼帳號。
- Pixel test events 有 PageView、ViewContent、InitiateCheckout。
- Server-side Purchase 仍由 Lemon Squeezy webhook 發送。
- Meta AI creative enhancement、translation、text improvement、multi-advertiser ads 都關閉。
- 第一波只有一個 broad ad set。

## 發布後判讀

前 2 到 4 小時：

- 只看 impressions、reach、spend。
- 不要因為沒有 purchase 就改設定。

前 12 到 24 小時：

- 看 landing page views、CTR、CPC、是否有 checkout start。
- 如果能正常花費，代表帳戶投遞管線恢復。

前 72 小時：

- 才開始看 checkout、purchase、CPA。
- 不要頻繁編輯 active ad，避免重新進入學習或觸發額外審核。

## 如果又不花費

不要刪 campaign。照這個順序查：

1. Account Quality / Business Support Home。
2. Page status。
3. Ad account status。
4. Payment method。
5. Account spending limit。
6. Ad set schedule、optimization、audience diagnostics。
7. 如果需要重建，只在同一個 ad account 裡 duplicate。

## 參考

- Meta ad review process: https://www.facebook.com/business/ads/review-policy-guidelines
- Meta Advertising Standards: https://transparency.meta.com/policies/ad-standards/
