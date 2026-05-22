markdown
# 💰 Bank Statement Analyser

Upload 3–6 months of bank statements and get a clear breakdown of:

- 📊 **Spending patterns** – where your money really goes
- 🔁 **Subscriptions you forgot about** – recurring charges you might not need
- ⚠️ **Anomalies** – unusual or unexpected transactions
- ✂️ **Concrete suggestions** – actionable advice to cut costs

Powered by **Gemma 4 26B A4B** instruction‑tuned model via Hugging Face.

---

## 📋 Prerequisites

Before you begin, make sure your local machine has:

- **Python 3.9 or higher** (recommended: 3.10)
- **Git** – to clone the repository
- **A Hugging Face account** (free) with a **User Access Token**  
  *[Create one here](https://huggingface.co/settings/tokens)*
- **At least 16 GB RAM** (32 GB recommended)  
- **GPU with 12+ GB VRAM** (optional but strongly recommended for fast inference) – if no GPU, the app will fall back to CPU (very slow for 26B model)

> **Note:** The 26B A4B model is large but uses Mixture‑of‑Experts to reduce compute. On a T4 GPU (free on Colab) inference takes ~2‑5 seconds per statement page. On CPU, expect 30‑60 seconds per page.
> DeMO 

https://github.com/user-attachments/assets/fdfd8ae8-4b81-41a2-8911-0e8805320ca6


---

## 🚀 Quick Start – Run the App Locally

### 1. Clone the repository

Open a terminal and run:

```bash
git clone https://github.com/AbelCodeCanvas/my-bank-app.git
cd my-bank-app
2. Create a virtual environment (recommended)
bash
python -m venv venv
Activate it:

Windows:
venv\Scripts\activate

macOS / Linux:
source venv/bin/activate

3. Install dependencies
bash
pip install --upgrade pip
pip install -r requirements.txt
If requirements.txt is not yet present, create it with the following (or install manually):

text
torch
transformers
accelerate
sentencepiece
protobuf
streamlit
pandas
pdfplumber
openpyxl
python-dotenv
4. Set up Hugging Face authentication
The Gemma 4 model requires a Hugging Face token (even for local download).

Create a file named .env in the project root:

bash
echo "HF_TOKEN=your_huggingface_token_here" > .env
Replace your_huggingface_token_here with the actual token you copied from your Hugging Face settings.

Alternatively, you can run huggingface-cli login and paste your token when prompted.

5. Run the application
The app is built with Streamlit (a simple data‑app framework). Start it with:

bash
streamlit run app.py
If your main file is named differently (e.g., main.py), adjust the command accordingly.

Your default browser will open at http://localhost:8501. If it doesn’t, manually visit that address.

🧪 How to Use the Bank Statement Analyser
Upload statements
Click the “Upload” button and select 3 to 6 months of statements.
Supported formats: PDF, CSV, XLSX (downloaded from most banks).

Wait for processing
The app extracts text using pdfplumber (for PDFs) or pandas (for CSVs).
Then Gemma 4 analyses each transaction, categorises spending, and detects subscriptions/anomalies.

View the reports

Spending patterns – bar charts and pie charts by category.

Hidden subscriptions – list of recurring merchants with frequency and total cost.

Anomalies – unusually large or duplicate transactions flagged.

Cost‑cutting suggestions – plain‑English recommendations (e.g., “Cancel Spotify Premium – unused for 2 months”).

Export the analysis
Click “Download full report (CSV)” to save the breakdown for your records.

🧠 Model Details & Why Gemma 4 26B A4B?
Aspect	Why it fits
Long context	Bank statements have hundreds of transactions. Gemma 4’s 8k‑32k context window lets us process entire months together.
Structured extraction	Instruction‑tuned version outputs clean JSON – perfect for categories, subscriptions, anomalies.
Reasoning ability	The 26B size is smart enough to infer “recurring meal delivery” as a subscription opportunity, without 31B’s cost.
A4B efficiency	Mixture‑of‑Experts reduces tokens/sec on consumer GPUs – runs on a T4 (16 GB) without OOM.
The model is loaded directly from Hugging Face:

python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "google/gemma-4-26B-A4B-it"   # instruction-tuned variant
tokenizer = AutoTokenizer.from_pretrained(model_name, token=HF_TOKEN)
model = AutoModelForCausalLM.from_pretrained(model_name, token=HF_TOKEN, device_map="auto")
⚙️ Environment Variables & Configuration
Variable	Purpose	Required
HF_TOKEN	Hugging Face user access token	Yes
MODEL_NAME	Override model (e.g., for smaller test)	No
MAX_CONTEXT	Token limit for statements (default 8192)	No
You can set them in .env or as system environment variables.

🐛 Troubleshooting
Problem	Likely solution
OutOfMemoryError on GPU	Use device_map="cpu" or quantization (add bitsandbytes and load in 4‑bit).
Model not found / 401 error	Your HF_TOKEN is invalid or expired. Generate a new one.
Slow PDF parsing	Install camelot-py or tabula-py for better table extraction (optional).
Streamlit won’t start	Run streamlit --version to verify installation. Try python -m streamlit run app.py.
📁 Repository Structure
text
my-bank-app/
├── app.py                 # Main Streamlit application
├── statement_parser.py    # PDF/CSV extraction logic
├── gemma_analyzer.py      # Calls Hugging Face Gemma 4 model
├── requirements.txt       # Python dependencies
├── .env                   # Your HF_TOKEN (never commit this!)
├── README.md              # This file
└── samples/               # Example bank statements (optional)
🤝 Contributing
Feel free to open issues or pull requests. For major changes, please discuss them first in an issue.

📄 License
MIT – use, modify, and distribute freely.

🙏 Acknowledgements
Google Gemma 4 team for the model

Hugging Face for hosting and transformers library

Streamlit for making data apps easy



