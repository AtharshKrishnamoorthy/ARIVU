# Arivu

**Arivu** is an open-source framework designed for building autonomous database agents. It bridges the gap between raw data warehouses and large language models (LLMs) by offering a dual-layer approach:

1. **A Powerful Python SDK**: Allows engineers to orchestrate text-to-SQL pipelines, hook up custom tools, and seamlessly inject execution memory layers.
2. **A Sleek Dashboard UI**: A Next.js-based observability platform designed for teams to instantly connect dialects, select cloud models, execute conversational prompts, and inspect pipeline execution latency natively.

## Quickstart

You can install the Arivu engine seamlessly using pip:

```bash
pip install arivu
```

Once installed natively on your Python environment, invoke the proxy router using your database credentials:

```python
import os
from arivu import Arivu

# 1. Establish connection with your relational cluster
db_app = Arivu.connect(
    database_url="postgresql://user:pass@localhost:5432/main",
    llm_provider="openai",
    monitoring=True
)

# 2. Formulate a natural language query
node = db_app.query("What were our top 3 highest revenue products last quarter?")

# 3. Run the intelligent execution pipeline
results = db_app.run_pipeline(node)

# 4. Extract data
print("Response:", results.get("response"))
print("Generated SQL:", results.get("sql"))
```

## Advanced Integrations

The Arivu Core Engine explicitly allows routing autonomous interaction agents natively into standard chat mediums including:
* Telegram
* Twilio WhatsApp Arrays
* Slack (via SocketMode)
* Extensible REST APIs

## Documentation 

Full API references and configuration matrices are accessible on our Documentation Matrix natively deployed via Mintlify!
