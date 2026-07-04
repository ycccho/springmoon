import time
import hmac
import hashlib
import base64
import requests
import gzip
import csv
import io

BASE_URL = "https://api.searchad.naver.com"

class NaverAdAPI:
    def __init__(self, api_key, secret_key, customer_id):
        self.api_key = api_key
        self.secret_key = secret_key
        self.customer_id = customer_id

    def _get_headers(self, method, path):
        """Generates HMAC-SHA256 signature headers for Naver API request authentication."""
        timestamp = str(int(time.time() * 1000))
        message = f"{timestamp}.{method.upper()}.{path}"
        
        # Calculate signature
        hash_obj = hmac.new(
            bytes(self.secret_key, "utf-8"),
            bytes(message, "utf-8"),
            hashlib.sha256
        )
        signature = base64.b64encode(hash_obj.digest()).decode("utf-8")
        
        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "X-Timestamp": timestamp,
            "X-API-KEY": self.api_key,
            "X-Customer": str(self.customer_id),
            "X-Signature": signature
        }
        return headers

    def _request(self, method, path, params=None, json_data=None, max_retries=3):
        """Makes an authenticated request with retries and exponential backoff."""
        url = f"{BASE_URL}{path}"
        
        for attempt in range(max_retries):
            headers = self._get_headers(method, path)
            try:
                response = requests.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data,
                    timeout=30
                )
                
                # Check for rate limit (429)
                if response.status_code == 429:
                    time.sleep(2 ** attempt + 0.5)
                    continue
                    
                response.raise_for_status()
                return response.json()
                
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise e
                time.sleep(2 ** attempt + 0.5)

    def request_stat_report(self, date_str, report_type):
        """
        Submits a report job to StatReportService.
        report_type: 'KEYWORD' or 'USER_RETURN' (Search queries)
        Returns the report job details.
        """
        path = "/stat-reports"
        clean_date = date_str.replace("-", "").replace(".", "")
        
        mapped_report_tp = "AD"
        if report_type in ["USER_RETURN", "EXPKEYWORD"]:
            mapped_report_tp = "EXPKEYWORD"
            
        payload = {
            "statDt": clean_date,
            "reportTp": mapped_report_tp
        }
        res = self._request("POST", path, json_data=payload)
        return res

    def get_report_job_status(self, job_id):
        """Polls the status of a requested report job."""
        path = f"/stat-reports/{job_id}"
        return self._request("GET", path)

    def download_report(self, download_url):
        """Downloads and parses the TSV report file."""
        response = requests.get(download_url, timeout=60)
        response.raise_for_status()
        content = response.content
        
        # Decompress if gzipped
        if content.startswith(b'\x1f\x8b'):
            content = gzip.decompress(content)
            
        tsv_text = content.decode('utf-8-sig', errors='ignore')
        
        # Parse TSV rows
        reader = csv.DictReader(io.StringIO(tsv_text), delimiter='\t')
        rows = []
        for row in reader:
            rows.append(row)
        return rows

    def fetch_report_data(self, date_str, ad_type, report_type):
        """
        High-level helper to trigger a report, poll until built, 
        download and return the mapped rows.
        """
        job = self.request_stat_report(date_str, report_type)
        job_id = job.get("reportJobId") or job.get("id")
        if not job_id:
            raise Exception("Failed to create report job ID.")
            
        # Poll status (up to 15 times with 2-second sleep)
        download_url = None
        for _ in range(15):
            time.sleep(2)
            status_res = self.get_report_job_status(job_id)
            status = status_res.get("status")
            
            if status == "BUILT":
                download_url = status_res.get("downloadUrl")
                break
            elif status in ["FAIL", "NONE"]:
                raise Exception(f"Report job failed with status: {status}")
                
        if not download_url:
            raise Exception("Report generation timed out.")
            
        # Download and map rows
        raw_rows = self.download_report(download_url)
        mapped_rows = []
        
        for row in raw_rows:
            # Handle case sensitivity in Naver headers
            c_id = row.get("CampaignId") or row.get("campaignId") or ""
            c_name = row.get("CampaignName") or row.get("campaignName") or ""
            g_id = row.get("AdgroupId") or row.get("adgroupId") or ""
            g_name = row.get("AdgroupName") or row.get("adgroupName") or ""
            kw = row.get("Keyword") or row.get("keyword") or ""
            
            # Detailed clicked query vs general keyword stats
            sq = row.get("SearchQuery") or row.get("searchQuery") or row.get("UserReturn") or row.get("userReturn") or ""
            
            # Map numeric values
            try:
                imp = int(row.get("Impressions") or row.get("impressions") or 0)
                clicks = int(row.get("Clicks") or row.get("clicks") or 0)
                cost = int(row.get("Cost") or row.get("cost") or 0)
                cpc = float(row.get("AvgCpc") or row.get("avgCpc") or 0.0)
            except ValueError:
                continue
                
            # Filter rows with 0 impressions or clicks to save space
            if imp == 0 and clicks == 0:
                continue
                
            mapped_rows.append((
                date_str, ad_type, c_id, c_name, g_id, g_name, kw, sq, imp, clicks, cost, cpc
            ))
            
        return mapped_rows

    def get_monthly_search_volumes(self, keywords):
        """
        Fetches search volume for a list of keywords in batches of 5.
        Enforces a 0.8 second sleep between requests to avoid API bans.
        """
        results = {}
        path = "/keywordtool"
        
        def clean_val(val):
            if not val:
                return 0
            val_str = str(val).strip()
            if val_str.startswith("<"):
                val_str = val_str.replace("<", "").strip()
            try:
                return int(val_str)
            except ValueError:
                return 0

        # Chunk in batches of 5 keywords
        for i in range(0, len(keywords), 5):
            chunk = keywords[i:i+5]
            hint_str = ",".join(chunk)
            
            try:
                res = self._request("GET", path, params={"hintKeywords": hint_str, "showDetail": "1"})
                kw_list = res.get("keywordList", [])
                for kw_info in kw_list:
                    kw_text = kw_info.get("relKeyword")
                    if kw_text in chunk:
                        pc_cnt = clean_val(kw_info.get("monthlyPcQcCnt"))
                        mo_cnt = clean_val(kw_info.get("monthlyMobileQcCnt"))
                        results[kw_text] = pc_cnt + mo_cnt
            except Exception as e:
                print(f"Error fetching volume for chunk {chunk}: {e}")
                
            # Defensive API delay
            time.sleep(0.8)
            
        return results
