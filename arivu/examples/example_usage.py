"""
examples/pipeline_usage.py
───────────────────────────
End-to-end examples: connection layer + pipeline layer working together.
"""

from arivu import Arivu
from arivu.pipeline import run_pipeline
from arivu.connection.exceptions import AuthError


# ─────────────────────────────────────────
# 1. Basic user query
# ─────────────────────────────────────────

# db = Arivu.connect(
#     host="YOUR_DB_HOST",
#     port=5432,
#     user="YOUR_DB_USER",
#     password="YOUR_DB_PASSWORD",
#     dbname="your_db_name",
#     mode="user",
#     ttl=3600,           
#     dialect="postgresql",
# )
# 
# pipeline_input = db.query("Get the users list who have phone number in their records")
# result = run_pipeline(pipeline_input)
# 
# print(result.response)
# # "The top 10 customers by total spend are: Alice ($4,200), Bob ($3,800)..."
# 
# print(result.sql)
# SELECT c.name, SUM(o.total) as total_spend
# FROM customers c JOIN orders o ON c.id = o.customer_id
# GROUP BY c.name ORDER BY total_spend DESC LIMIT 10

# print(result.success)   # True
# print(result.trace_events)
# [
#   {"node": "query_intake",  "status": "ok", "latency_ms": 3.2,  ...},
#   {"node": "sql_generator", "status": "ok", "latency_ms": 820.1, ...},
#   ...
# ]


# ─────────────────────────────────────────
# 2. User mode — permission violation caught by verifier
# ─────────────────────────────────────────

# db_user = Arivu.connect(
#     host="localhost", port=5432, user="atharsh",
#     password="secret", dbname="ecommerce", mode="user",
# )
# 
# result = run_pipeline(db_user.query("drop the orders table"))
# 
# print(result.success)       # False
# print(result.error)         # "Mode 'user' does not permit 'DROP' statements."
# print(result.error_node)    # "error_boundary"
# print(result.response)
# "Sorry, I ran into an issue processing your request..."


# ─────────────────────────────────────────
# 3. Admin mode — destructive SQL → approval gate
# ─────────────────────────────────────────

# db_admin = Arivu.connect(
#     host="localhost", port=5432, user="admin",
#     password="admin_secret", dbname="ecommerce", mode="admin",
# )
# 
# result = run_pipeline(db_admin.query("drop the temp_staging table"))
# 
# if result.pending_approval:
#     print("Waiting for human approval...")
#     print(f"SQL to approve: {result.sql}")
#     # Integration layer surfaces this to the admin via Telegram / WhatsApp
#     # Admin sends /approve or /reject
#     # Pipeline resumes with approved=True/False


# ─────────────────────────────────────────
# 4. RLHF feedback
# ─────────────────────────────────────────

# result = run_pipeline(
#     db.query("how many orders were placed last week?"),
#     rlhf_signal="positive",   # user liked the response
# )
# print(result.success)  # True — signal stored in RLHF log


# ─────────────────────────────────────────
# 5. Inspect the compiled graph
# ─────────────────────────────────────────

from arivu.pipeline import get_compiled_graph

graph = get_compiled_graph()
print(graph.get_graph().draw_ascii())
# Prints ASCII art of the full node/edge graph for debugging


# ─────────────────────────────────────────
# 6. Full clean pattern with context manager
# ─────────────────────────────────────────

# with Arivu.connect(
#     host="localhost", port=5432, user="atharsh",
#     password="secret", dbname="ecommerce",
#     mode="user", ttl=3600,
# ) as db:
#     for question in [
#         "how many orders were placed today?",
#         "what is the average order value?",
#         "which product category has the highest revenue?",
#     ]:
#         result = run_pipeline(db.query(question))
#         if result.success:
#             print(f"Q: {question}")
#             print(f"A: {result.response}\n")
#         else:
#             print(f"Error on '{question}': {result.error}")