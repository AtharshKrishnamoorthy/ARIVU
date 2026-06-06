<div align="center">
  <a href="https://arivu-omega.vercel.app">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="site/public/arivu-logo-dark.png">
      <img alt="Arivu Framework" src="site/public/arivu-logo-light.png" width="300">
    </picture>
  </a>

  <br />

  <h3>The Agentic Database Command Center</h3>

  <p>
    An open-source framework for orchestrating autonomous database agents, integrating seamless <strong>Text-to-SQL</strong> pipelines with a powerful <strong>Full-Stack Workspace & Observability Dashboard</strong>.
  </p>

  <p>
    <a href="https://pypi.org/project/arivu-ai/"><img src="https://img.shields.io/pypi/v/arivu-ai?color=emerald&label=pypi" alt="PyPI version"></a>
    <a href="https://github.com/AtharshKrishnamoorthy/ARIVU/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
    <a href="https://arivu-omega.vercel.app"><img src="https://img.shields.io/badge/Website-arivu--omega.vercel.app-black" alt="Website"></a>
    <a href="https://arivu.mintlify.app/"><img src="https://img.shields.io/badge/Docs-Mintlify-047857" alt="Docs"></a>
    <a href="https://github.com/AtharshKrishnamoorthy/ARIVU/stargazers"><img src="https://img.shields.io/github/stars/AtharshKrishnamoorthy/ARIVU?style=social" alt="GitHub stars"></a>
  </p>
  
  <br />

  <video src="https://github.com/AtharshKrishnamoorthy/ARIVU/raw/main/arivu/docs/images/motion-video.mp4" width="800" controls autoplay loop muted></video>
</div>

---

## 🚀 What is Arivu?

Arivu bridges the gap between your raw data warehouses and Large Language Models (LLMs). It isn't just a wrapper; it's a **dual-layer infrastructure**:

1. **Python SDK & MCP:** A streamlined toolkit (`arivu-ai`) to embed text-to-SQL pipelines, manage database connections, integrate seamlessly with IDEs via the Model Context Protocol (MCP), and deploy conversational agents across communication channels.
2. **Full-Stack Workspace:** A locally deployable Next.js dashboard that provides an interactive chat interface, custom generative dashboards, DB explorer, automations, and granular pipeline tracing in real-time.

---

## ✨ Core Features

- **Multi-Dialect Federation:** Securely connect and query across PostgreSQL, MySQL, SQLite, Databricks, and Snowflake using natural language.
- **Dynamic LLM Routing:** Hot-swap between OpenAI, Anthropic, Groq, DeepSeek, Ollama, and Hugging Face directly from your code or the dashboard.
- **Agentic Chat & Generative UI:** Generate optimized SQL, auto-correct syntax errors, and instantly render interactive charts and data tables via the chat workspace.
- **Workspace Tools:** Inspect schemas with the **DB Explorer**, curate **Saved Queries**, and pin insights to custom **Dashboards**.
- **Automations & Channels:** Schedule automated reports and dispatch agents to Slack, Discord, Telegram, or Email using built-in adapters.
- **MCP Native:** Expose your entire database seamlessly to AI editors like Cursor and Windsurf using our built-in Model Context Protocol server.
- **End-to-End Tracing:** Visually debug agent reasoning, token usage, and execution latency right from the observability tab.

---

## ⚡ Quickstart

Install the core Python SDK via pip:

```bash
pip install arivu-ai
```

### 1. Connect to Your Database

`Arivu.connect()` takes explicit host/port/user/password/dbname parameters — not a connection URL string. Choose between `user` (read-only) and `admin` (DML with approval gate) modes:

```python
from arivu import Arivu

# Connect in read-only user mode
db = Arivu.connect(
    host="your-db-host",        # e.g. "db.example.supabase.com"
    port=5432,
    user="your-db-user",
    password="your-db-password",
    dbname="your-db-name",
    mode="user",                # "user" (read-only) or "admin" (DML allowed)
    ttl=3600,                   # schema cache TTL in seconds
    dialect="postgresql",       # "postgresql", "mysql", or "sqlite"
)
```

For **SQLite** (zero infrastructure):

```python
sqlite_db = Arivu.connect(
    dialect="sqlite",
    dbname="/path/to/your/local.db",
    mode="user",
)
```

### 2. Run the Agentic Pipeline

Use `db.query()` to prepare the pipeline input, then pass it to `run_pipeline()`:

```python
from arivu.pipeline import run_pipeline

pipeline_input = db.query("Show me the top 10 customers by total spend")
result = run_pipeline(pipeline_input)

print(result.response)   # Natural language answer
print(result.sql)        # The generated SQL
print(result.success)    # True / False
print(result.trace_events)  # Per-node latency trace
```

### 3. Admin Mode — Destructive SQL Approval Gate

In `admin` mode, destructive operations (DROP, DELETE) are paused for human approval before execution:

```python
db_admin = Arivu.connect(
    host="localhost", port=5432, user="admin",
    password="admin_secret", dbname="ecommerce",
    mode="admin",
)

result = run_pipeline(db_admin.query("drop the temp_staging table"))

if result.pending_approval:
    print("Waiting for human approval...")
    print(f"SQL to approve: {result.sql}")
    # Admin approves via Telegram /approve or REST API
```

### 4. Deploy to a Channel

Connect Arivu to Telegram, WhatsApp, or expose it as a REST API:

```python
from arivu.integrations import TelegramIntegration, WhatsAppIntegration, RESTIntegration

# Telegram bot
telegram_bot = TelegramIntegration(
    db=db,
    token="YOUR_TELEGRAM_BOT_TOKEN",
    admin_user_ids=[123456789],  # your numeric Telegram user ID
)
telegram_bot.start()  # blocking — runs until Ctrl+C

# REST API (FastAPI)
rest_api = RESTIntegration(db=db)
rest_api.start(host="0.0.0.0", port=8000)

# WhatsApp (via Twilio)
whatsapp_bot = WhatsAppIntegration(
    db=db,
    admin_numbers=["+91XXXXXXXXXX"],
)
whatsapp_bot.start(host="0.0.0.0", port=8000)
```

### 5. Memory & Session History

Arivu persists every interaction automatically. You can query the memory layer directly:

```python
from arivu.memory import load_session_history, get_pipeline_traces, get_rlhf_log

# Load a session's conversation history
history = load_session_history("sess-demo-001")

# Retrieve per-node pipeline traces for observability
traces = get_pipeline_traces(session_id="sess-demo-001", limit=5)

# View RLHF feedback log
log = get_rlhf_log(limit=10)
```

---

## 💻 The Full-Stack Workspace

Arivu ships with a stunning, no-code visual interface that acts as your complete command center. It provides Chat, Dashboards, DB Explorer, Saved Queries, Automations, and full pipeline tracing.

### Recommended: Docker Compose

The easiest way to launch the entire workspace is using Docker:

```bash
# Clone the repository
git clone https://github.com/AtharshKrishnamoorthy/ARIVU.git
cd ARIVU

# Launch the backend and frontend simultaneously
docker compose up -d --build
```

Visit `http://localhost:3000` to start visually interacting with your databases!

### Manual Installation (Development)

If you prefer to run the services manually without Docker:

**1. Start the Backend:**
```bash
git clone https://github.com/AtharshKrishnamoorthy/ARIVU.git
cd ARIVU
pip install -r requirements.txt
python -m arivu.dashboard.backend --port 8000
```

**2. Start the Frontend:**
Open a new terminal window:
```bash
cd ARIVU/arivu/dashboard/frontend
npm install
npm run dev
```

Visit `http://localhost:3000`.

---

## 📖 Documentation

For detailed guides, API references, architecture diagrams, and more SDK examples, check out our [official documentation](https://arivu.mintlify.app/).

---

## 🤝 Contributing

We welcome contributions! Whether it's adding a new database dialect, extending the dashboard UI, or improving prompt resolution:

1. Fork the repo and create your branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

Please read our [Contributing Guidelines](arivu/docs/CONTRIBUTING.md) for details on code style and testing.

---

## 📄 License

Arivu is open-source software licensed under the **[MIT License](LICENSE)**.
