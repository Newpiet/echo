# 邮件提醒函数部署说明

## 前置
- 已有 Firebase 项目并启用 Blaze 计费（计划任务需要）
- 安装 Firebase CLI 并登录：`npm i -g firebase-tools && firebase login`
- SendGrid 创建 API Key，并验证发件人（Single Sender 或 Domain）

## 目录结构
```
functions/
  package.json
  index.js
  DEPLOY.md
```

## 安装依赖
```
cd functions
npm install
```

## 配置环境变量
使用 Firebase Functions 环境变量存储敏感信息：
```
firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY" sendgrid.from="no-reply@yourdomain"
```
如果使用本例代码中的 `process.env`，则需在部署环境（如 Cloud Functions 控制台）配置 `SENDGRID_API_KEY` 与 `FROM_EMAIL`。也可改为：
```
const SENDGRID_API_KEY = functions.config().sendgrid.key;
const FROM_EMAIL = functions.config().sendgrid.from;
```
并删去 `process.env` 的读取。

## 启用计费与计划任务
- 在 Firebase 控制台启用 Blaze 计划
- 首次部署后，控制台中 Functions → Triggers 可见 `scheduledDailyReminder` 的定时触发器（当前设置为每 5 分钟执行一次）。

## 部署
```
cd functions
firebase deploy --only functions
```

## 验证
- Firestore：`users/{uid}` 文档包含 `settings.reminderEnabled/reminderTime/reminderEmail`
- Firestore：`users/{uid}/sparks` 存在当天 `status != done` 的记录
- 等待到设定时间点（或手动触发）观察 Functions 日志与收件箱

## 本地测试（可选）
```
firebase emulators:start --only functions,firestore
```
- 注意：本地模拟器不直接支持 `pubsub.schedule`，可改为 HTTP 触发器测试逻辑。
