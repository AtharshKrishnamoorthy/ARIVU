<div align="center">
  <a href="https://arivu.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="site/public/arivu-logo-dark.png">
      <img alt="Arivu Framework" src="site/public/arivu-logo-light.png" width="300">
    </picture>
  </a>

  <br />

  <h3>The Agentic Database Command Center</h3>

  <p>
    An open-source framework for orchestrating autonomous database agents, integrating seamless <strong>Text-to-SQL</strong> pipelines with a beautiful <strong>No-Code Observability Dashboard</strong>.
  </p>

  <p>
    <a href="https://pypi.org/project/arivu-ai/"><img src="https://img.shields.io/pypi/v/arivu-ai?color=emerald&label=pypi" alt="PyPI version"></a>
    <a href="https://github.com/AtharshKrishnamoorthy/ARIVU/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
    <a href="https://arivu.io"><img src="https://img.shields.io/badge/Website-arivu.io-black" alt="Website"></a>
    <a href="https://arivu.io/docs"><img src="https://img.shields.io/badge/Docs-Mintlify-047857" alt="Docs"></a>
    <a href="https://github.com/AtharshKrishnamoorthy/ARIVU/stargazers"><img src="https://img.shields.io/github/stars/AtharshKrishnamoorthy/ARIVU?style=social" alt="GitHub stars"></a>
  </p>
</div>

---

## 🚀 What is Arivu?

Arivu bridges the gap between your raw data warehouses and Large Language Models (LLMs). It isn't just a wrapper; it's a **dual-layer infrastructure**:

1. **Python SDK:** A streamlined toolkit (`arivu-ai`) to embed text-to-SQL pipelines, manage database connections, and deploy conversational agents across multiple communication channels (Slack, Discord, WhatsApp, Telegram, REST).
2. **Observability Dashboard:** A locally deployable Next.js dashboard that visualizes your AI pipeline traces, latency, LLM routing, and SQL execution logs in real-time.

---

## ✨ Core Features

- **Multi-Dialect Federation:** Securely connect and query across PostgreSQL, MySQL, and SQLite clusters using natural language.
- **Dynamic LLM Routing:** Hot-swap between OpenAI, Anthropic, Groq, DeepSeek, Ollama, and Hugging Face directly from your code or the dashboard.
- **Agentic Workflows:** Arivu parses intent, generates optimized SQL, auto-corrects syntax errors, and formats structured responses automatically.
- **Native Channels:** Deploy your database agents directly into Slack, Discord, Telegram, or WhatsApp using built-in adapters.
- **End-to-End Tracing:** Visually debug agent reasoning and execution latency right from the observability dashboard.

---

## ⚡ Quickstart

Install the core Python SDK via pip:

```bash
pip install arivu-ai
```

### 1. Simple Data Querying

Connect to your database and interrogate it using natural language in just 4 lines of code:

```python
from arivu import Arivu

# 1. Initialize the engine
app = Arivu.connect(
    database_url="postgresql://user:pass@localhost:5432/main",
    llm_provider="openai",  # Or 'anthropic', 'groq', 'ollama', etc.
    monitoring=True         # Enables dashboard tracing
)

# 2. Formulate your prompt
query = app.query("What were our top 3 highest revenue products last quarter?")

# 3. Execute the agentic pipeline
results = app.run_pipeline(query)

# 4. View results
print(results.get("response"))
print("Generated SQL:", results.get("sql"))
```

### 2. Deploy to a Channel (e.g., Telegram)

Arivu allows you to expose your database to authorized users via chat platforms:

```python
from arivu.integrations.telegram import TelegramAdapter

# Pass your existing 'app' engine to the adapter
bot = TelegramAdapter(
    bot_token="YOUR_TELEGRAM_BOT_TOKEN",
    arivu_app=app 
)

# Start listening for messages!
bot.start()
```

---

## 📊 The Observability Dashboard

Arivu ships with a stunning, no-code visual interface for monitoring your agents.

To run the dashboard locally:

```bash
# Clone the repository
git clone https://github.com/AtharshKrishnamoorthy/ARIVU.git
cd ARIVU

# Navigate to the dashboard
cd site

# Install dependencies and start
npm install
npm run dev
```

Visit `http://localhost:3000` to visually manage connections, test prompts, and trace pipeline executions.

---

## 📖 Documentation

For detailed guides, API references, architecture diagrams, and more SDK examples, check out our [official documentation](https://arivu.io/docs).

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
