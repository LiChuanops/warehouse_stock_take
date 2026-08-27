# 李泉冷房盘点 Li Chuan Stock Take

四个地点(CR1 / CR2 / CR3A / B15)共用的一支盘点 PWA。开进去先选地点,选完才进货品清单。

React + TypeScript + Vite,离线优先,部署在 GitHub Pages。

---

## 上线前要做的四件事

照顺序做,第 1 步没做完 app 是不会动的。

### 1. 先换 Apps Script(硬性,不做 app 就废掉)

新 app 送出去的资料是 `{ batchId, sheetName, rows }`,线上那支旧脚本读的是一个阵列,
收到新格式会在 `data[0].sheetName` 炸掉,回 `success:false`,app 会一直重试送不出去。

1. 打开桌面上的 `APPS_SCRIPT_新版.gs`,全选复制
2. 到 Google Apps Script 专案,把 `doPost` 那个档案的内容整个换掉
3. 在编辑器里选 `setup` 这支函式,按「执行」跑一次(会建立隐藏的 `_SyncLog` 分页)
4. 「部署 > 管理部署作业 > 编辑(铅笔) > 版本选『新版本』> 部署」

> ⚠️ 第 4 步一定要用「编辑现有部署」,不要「新增部署作业」。
> 新增会给你一个不一样的 `/exec` 网址,那样就得回来改 `src/lib/config.ts`。

新脚本同时收旧格式,所以换过去之后,员工手机上还没更新的旧 app 也照样能用。

### 2. 建 repo 并推上去

```bash
cd Desktop/stocktake-pwa
# git init 和 git add 已经做过了,直接 commit
git commit -m "冷房盘点 PWA 第一版"
git branch -M main
git remote add origin https://github.com/<你的帐号>/<repo 名字>.git
git push -u origin main
```

repo 叫什么名字都可以。Vite 的 `base` 设成相对路径 + 用 HashRouter,
所以不管发布在哪个子路径都不用改代码。

### 3. 打开 GitHub Pages

repo 的 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。

选好之后 `.github/workflows/deploy.yml` 会自动跑:装依赖 → build → 发布 `dist/`。
之后每次推上 main 都会自动重新部署。第一次大概三分钟。

网址会长这样:`https://<你的帐号>.github.io/<repo 名字>/`

### 4. 员工手机安装

用 Chrome 开上面那个网址 → 右上角三点 → 「加到主画面」。

旧的 CR1/CR2/CR3A/B15 四支 app 建议留着跑一两个星期,确认新的没问题再叫大家删掉。
两边写进的是同一张 Google Sheet,并行不会打架。

---

## 这版解决了什么

### 保存不到

旧版 `submitToGoogleSheet()` 的 `const data` 宣告在 `try {}` 里面,`catch {}` 根本看不到它。
所以只要提交失败走进 catch,`saveToSessionStorage(data)` 自己就会丢 ReferenceError ——
资料没存进去,连「提交失败,已保存」那个提示都弹不出来。员工看到转圈停了就以为存好了。

暂存又是用 `sessionStorage`,切走 app 或杀后台就整批蒸发。

现在:按下保存 → 写进 IndexedDB 的出货队列 → 立刻回「已保存」。
之后由背景引擎负责送。送不出去就排队重试(3 秒 → 8 秒 → 20 秒 → 1 分 → 3 分 → 10 分),
永远不会因为网络问题掉资料。顶部那条状态列随时看得到还有几笔没送出去。

另外旧版还有一个隐形的坑:Apps Script 权限设错时会回一整页 HTML 登入页,
而且状态码是 200,旧版的 `response.ok` 判定成成功。新版会解析回应内容,骗不过去。

### 保存了两次

三个原因叠在一起:

1. `submitToGoogleSheet()` 没有任何进行中的锁,`online` 事件会在上一次还在飞的时候再调一次
2. 保存按钮没有 disable,戴手套点两下就是两笔
3. Apps Script 的 `doPost` 既没有 LockService 也没有幂等键,来两次就写两次

现在每一批带一个 `batchId`。前端有 in-flight 锁 + 按钮 ref 锁;
后端用 LockService 上锁,写之前先查 `_SyncLog` 有没有看过这个 batchId,看过就直接回成功什么都不写。
连 Supabase 那段也改成由 batchId 算出固定 id 再 upsert,重送不会长出重复的列。

### 很卡

- 旧版每次按键都开一个 300ms 计时器再去搜寻,还绑了两次 Enter 事件(按一次回车跑两次)
- 每扫一笔就用字串拼接 + `innerHTML` 重画整份清单
- modal 和 loading 遮罩用了 `backdrop-filter: blur()`,便宜安卓机上很吃力
- Service Worker 对每一个请求都 `cache.open`,连 POST 都想缓存(Cache API 不支援 POST,会丢错)
- 保存要等 Apps Script 写完表格 **再** 同步写完 Supabase 才回应,通常 2 到 5 秒

现在:条码只要**刚好等于**某个条码就立刻开弹窗,没有计时器;清单用 React 差分更新;
没有任何 blur;Workbox 只处理 GET;保存是本机操作,0.1 秒回应。
打包也从 145KB 降到 92KB(gzip)—— 拿掉了 `@supabase/supabase-js`,
那支 SDK 我们只用来做一次 select 和一次 rpc,改成直接打 REST。

---

## 开发

```bash
npm install
npm run dev        # 会同时开 LAN 网址,可以直接用手机连同一个 WiFi 测
npm run build
npm run typecheck
```

## 结构

```
src/
  lib/
    config.ts        四个地点的设定、Apps Script 网址、重试间隔
    types.ts         资料型别。SheetRow 的栏位顺序 = Google Sheet 的 A 到 I 栏,不可以改
    db.ts            IndexedDB(开不起来时自动退到 localStorage)
    api.ts           Supabase REST,没有用 SDK
    products.ts      产品清单:快取优先,过期才连网
    staff.ts         盘点人员名单,快取 12 小时
    session.ts       进行中的盘点 + 组出要送的批次
    sync.ts          出货队列与同步引擎 ← 核心
    i18n.ts          中英文字典
  components/
    SyncBar          顶部同步状态列
    QuantitySheet    输入箱/包数量的底部弹层
    OperatorPicker   盘点人员选择器(自己做的,不用原生 select)
    Toast / Confirm / LangToggle
  pages/
    RoomPicker       选地点
    CountPage        扫码盘点
    RecordsPage      记录、修改、保存
    SyncPage         同步状态、失败原因、手动重试
```

## 图标

App 图标是用 `scripts/make-icons.mjs` 产生的(纯几何路径,不依赖字体)。
改配色或形状就改那支档案里的 SVG,然后:

```bash
node scripts/make-icons.mjs apply A
```

会重新产生 `public/icons/` 里的 icon-192 / icon-512 / icon-maskable。
公司的厨师 logo(`icons/lichuan-logo.png`)是原图,没有改过,只在选择地点那一页的标题列显示。

## 要注意的地方

- **`SheetRow` 的栏位顺序不能改。** 每日点货报告那支脚本是照 A 到 H 栏固定位置读的,改了报告就断。
- **送 Apps Script 的 fetch 不要加 `Content-Type` 标头。** 加了会触发 CORS preflight(OPTIONS),
  而 Apps Script 的 `/exec` 不回应 OPTIONS,整个请求会失败。不加的话浏览器当成简单请求,直接过。
- **`config.ts` 里的 anon key 是设计上就公开的**,权限完全由 RLS 决定,目前只能读产品清单和呼叫
  `get_stock_take_staff`。真正不能外流的是 service_role key,那把只存在 Apps Script 里。
- **要加新地点**:在 Supabase 的 `app_product_list_items` 建好清单(记得填 `skus`),
  在 `config.ts` 的 `ROOMS` 加一列,再在 Apps Script 的 `WAREHOUSE_BY_SHEET` 加对应的 warehouse_id,
  最后确认 Google Sheet 有那个分页。
