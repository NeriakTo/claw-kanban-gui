# 云端 Kanban 使用指南

当你在 [teammate.work](https://teammate.work) 登录并生成 API Key 后，可以将 Key 配置到 claw-kanban 插件，让龙虾（OpenClaw Agent）把任务进展同步到云端看板。

## 一、获取 API Key

1. 打开 [https://teammate.work](https://teammate.work)
2. 使用 Google 登录
3. 进入 **Settings** → **API Keys**
4. 点击 **Create API Key**，复制生成的 Key（形如 `ck_sk_xxx...`，只显示一次，请妥善保存）

## 二、配置 claw-kanban 插件

在 OpenClaw 的配置文件中添加 kanban 插件的云端配置。

### 配置文件位置

通常为 `~/.openclaw/openclaw.json`，在 `plugins.entries` 下配置：

```json
{
  "plugins": {
    "entries": {
      "claw-kanban": {
        "enabled": true,
        "config": {
          "apiKey": "ck_sk_你的API密钥",
          "cloudApiEndpoint": "https://teammate.work/api/v1"
        }
      }
    }
  }
}
```

- **apiKey**：必填。在 Web 后台生成的 API Key，插件仅支持云端模式。
- **cloudApiEndpoint**：可省略，默认即为 `https://teammate.work/api/v1`

### 重启 Gateway

修改配置后需要重启 OpenClaw Gateway：

```bash
openclaw gateway restart
```

## 三、使用流程

1. **用户给龙虾布置任务**（自然语言，例如）：
   - 「帮我研究一下 AGI 安全领域最近的重要论文」
   - 「整理一下我昨天写的会议纪要」
   - 「写一个 Python 脚本，每天备份我的照片」

2. **龙虾自动上报任务**  
   龙虾内置 `kanban-manage` skill，会主动：
   - 接到任务时创建任务卡片（in_progress）
   - 执行过程中通过 `logMessage` 上报进展
   - 完成或失败时更新状态（done / failed）

3. **在 Web 上看板查看**  
   打开 [https://teammate.work/dashboard](https://teammate.work/dashboard)，即可看到所有任务及其进展。

## 四、数据流示意

```
用户: "帮我研究 AGI 安全论文"
    ↓
龙虾 (OpenClaw Agent)
    ↓ 调用 kanban_update(action='create', title='研究 AGI 安全论文', ...)
    ↓
claw-kanban 插件 (CloudBoardStore)
    ↓ POST /api/v1/tasks (Bearer API_KEY)
    ↓
claw-kanban-cloud (Vercel)
    ↓ 校验 API Key → 写入 Supabase
    ↓
Web Dashboard 展示
```

用户只需要把 Key 配置好，龙虾会按 skill 自动上报，无需额外操作。

## 五、故障排查

- **任务没有出现在 Dashboard**：确认 `apiKey` 正确、Gateway 已重启，且控制台有 `[claw-kanban] Cloud mode: syncing to Claw Kanban Cloud.`
- **401 Invalid API Key**：检查 Key 是否完整复制、未被吊销
