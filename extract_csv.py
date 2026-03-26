import os
import glob
import csv
import re

directory = r"d:\jailbreak-benchmark\bench\results\2026-run"
csv_file = r"d:\jailbreak-benchmark\bench\results\2026-run\results.csv"

data = []

for filepath in glob.glob(os.path.join(directory, "*.md")):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 1. Extract model name
    model_match = re.search(r"# Test Run:\s*(.*?)\s*-", content)
    model_name = model_match.group(1).strip() if model_match else "Unknown"
    
    # 2. Extract UUID for ASSISTANT
    uuid_match = re.search(r"## ASSISTANT\n\*\*ID:\*\*\s*([a-f0-9\-]+)", content, re.IGNORECASE)
    id_uuid = uuid_match.group(1).strip() if uuid_match else ""
    
    # Check if it was an error
    is_error = "## ERROR OCCURRED" in content
    if not id_uuid and is_error:
        id_uuid = "ERROR"
        
    # 3. Extract prompt
    prompt = ""
    assistant_idx = content.find("## ASSISTANT")
    if assistant_idx != -1:
        user_block = content[:assistant_idx]
    else:
        user_block = content
        
    user_match = re.search(r"## USER\n\*\*ID:\*\*.*?\n### Text Content(.*)", user_block, re.DOTALL)
    if user_match:
        prompt = user_match.group(1).strip()
        if prompt.endswith("---"):
            prompt = prompt[:-3].strip()
            
    # 4. Extract response
    response = ""
    if is_error:
        err_match = re.search(r"\*\*Error Message:\*\*(.*?)(?:\*\*Timestamp|\n\n|\Z)", content, re.DOTALL)
        if err_match:
            response = "Error: " + err_match.group(1).strip()
        else:
            response = "Error"
    else:
        if assistant_idx != -1:
            assistant_block = content[assistant_idx:]
            assistant_match = re.search(r"## ASSISTANT\n\*\*ID:\*\*.*?\n### Text Content(.*)", assistant_block, re.DOTALL)
            if assistant_match:
                response = assistant_match.group(1).strip()
                if response.endswith("---"):
                    response = response[:-3].strip()

    data.append([id_uuid, model_name, prompt, response])

with open(csv_file, "w", newline='', encoding="utf-8", errors='replace') as f:
    writer = csv.writer(f)
    writer.writerow(["id(uuid)", "model_name", "prompt", "response(text)"])
    writer.writerows(data)

print(f"Successfully wrote {len(data)} rows to {csv_file}")
