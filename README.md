# 🏆 任职资格认证 AI 初筛系统

基于 AI 的**任职资格认证智能初审工具**。上传员工举证PPT，自动对标岗位标准，逐条评分，输出全面认证报告。

---

## ✨ 核心功能

- 🔍 **智能识别**：自动从PPT中提取员工姓名、部门、岗位、申报级别
- 📏 **自动匹配**：根据岗位关键词自动匹配对应的任职资格标准
- 📊 **逐条对标**：标准中的每条关键成果和关键行为逐一检查评分
- 📝 **报告生成**：自动生成完整的认证初审报告（Markdown/Word）
- 🤖 **AI 辅助**：支持AI生成新岗位标准、审核标准质量
- 📦 **批量处理**：支持批量上传PPT，一次性处理多位员工

---

## 🚀 快速开始

### 环境要求

- Python 3.10+
- DeepSeek API Key（[申请地址](https://platform.deepseek.com/)）

### 安装

```bash
# 1. 克隆项目
git clone https://github.com/YOUR_USERNAME/qualification-ai-screening.git
cd qualification-ai-screening

# 2. 安装依赖
pip install -r web_app/requirements.txt

# 3. 配置环境变量
cp web_app/.env.example .env
# 编辑 .env 文件，填入你的 DEEPSEEK_API_KEY

# 4. 启动服务
cd web_app
python app.py
```

浏览器访问 `http://localhost:5890` 即可使用。

### 添加岗位标准

将岗位标准文件（`.xlsx`）放入 `岗位标准/` 目录下对应的序列子目录（`P序列/`、`S序列/`、`T序列/`），然后在网页端点击「🔄 同步刷新标准」即可。

---

## 📊 评分体系

| 分数区间 | 评级 | 判定标准 |
|---------|------|---------|
| **9-10分** | ⭐ 卓越 | 完全满足且超出预期，有数据验证，有创新亮点 |
| **7-8分** | ✅ 达标 | 基本满足标准要求，证据充分 |
| **5-6分** | ⚠️ 勉强 | 部分满足，有相关内容但不够完整 |
| **3-4分** | ❌ 不足 | 仅有零星举证，大量内容缺失 |
| **0-2分** | 🚫 严重缺失 | 完全缺少对应举证 |

### 认证结论

- ≥ 8.0 → ✅ **通过** — 推荐进入专家评审
- 6.0-7.9 → ⚠️ **有条件通过** — 需补充材料
- < 6.0 → ❌ **不通过** — 建议下个周期再申请

---

## 📂 项目结构

```
任职资格系统agent/
├── CLAUDE.md                    ← AI Agent 系统提示词（CLI模式）
├── README.md                    ← 本说明文档
├── .gitignore
├── 标准注册表/
│   └── standards_registry.json  ← 标准文件索引映射
├── 岗位标准/                    ← 岗位标准文件（.xlsx）
│   ├── P序列/                   ← 职能序列
│   ├── S序列/                   ← 营销序列
│   └── T序列/                   ← 技术序列
├── web_app/                     ← Web 管理后台
│   ├── app.py                   ← Flask 应用入口
│   ├── config.py                ← 配置
│   ├── database.py              ← 数据库初始化
│   ├── models/                  ← 数据模型
│   ├── routes/                  ← API 路由
│   ├── services/                ← 业务服务（AI、解析）
│   ├── static/                  ← 前端资源
│   └── templates/               ← 页面模板
└── 输出报告/                    ← 生成的认证报告（不入库）
```

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | Python Flask + SQLAlchemy + SQLite |
| **前端** | 原生 JavaScript（无框架依赖） |
| **AI 引擎** | DeepSeek V4 Pro（兼容 Anthropic SDK） |
| **文件解析** | python-pptx / openpyxl / pdfplumber |

---

## ⚙️ 环境变量

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `DEEPSEEK_API_KEY` | ✅ 是 | DeepSeek API 密钥 | — |
| `AI_MODEL` | 否 | AI 模型名称 | `deepseek-V4-pro` |
| `AI_BASE_URL` | 否 | AI API 地址 | `https://api.deepseek.com/anthropic` |
| `AI_MAX_TOKENS` | 否 | 最大 Token 数 | `8192` |
| `SECRET_KEY` | 否 | Flask 密钥 | 内置默认值 |

---

## 📝 CLI 模式（Claude Code）

本项目也支持通过 Claude Code 在终端中使用：

| 命令 | 功能 |
|------|------|
| `/check` — 拖入 PPT | 单个员工认证检查 |
| `/batch` | 批量扫描举证材料目录 |
| `/review` — 拖入标准 | 审核标准文件质量 |
| `/register` — 拖入标准 | 注册新标准文件 |

详见 `CLAUDE.md`。

---

## ⚠️ 注意事项

- 举证的PPT内容必须是文字可读的（不能全是截图扫描件）
- 标准文件首次使用前需在网页端同步刷新
- 报告生成保存在 `输出报告/` 目录
- 标准文件支持在线查看，不提供下载功能以保护公司数据安全

---

## 📄 License

MIT License
