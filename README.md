# my-bank-app
Bank statement Analyzer — upload 3–6 months of statements, get a breakdown of spending patterns, subscriptions you forgot about, anomalies, and concrete suggestions to cut your costs.

For my Bank Statement Analyser, I used Gemma 4 26B A4B (the instruction-tuned variant) on Hugging Face. While not exactly one of the standard sizes (E2B, E4B, or 31B Dense), this 26B parameter model strikes an ideal balance for the task:

Long context handling – Bank statements over 3–6 months contain hundreds of transactions. The model’s large context window lets me feed entire statements without chunking, preserving temporal patterns.

Structured extraction – Gemma 4’s instruction-tuning excels at parsing semi-structured data (PDF/CSV statements) and outputting consistent JSON breakdowns of spending, subscriptions, and anomalies.

Reasoning for suggestions – The 26B size provides enough reasoning capacity to identify cost-cutting opportunities (e.g., duplicate subscriptions, high-fee accounts, irregular charges) without the latency or cost of a dense 31B model.

A4B efficiency – The Mixture-of-Experts (A4B) architecture reduces compute per token, making it feasible to run locally or on a free Hugging Face T4 GPU.
