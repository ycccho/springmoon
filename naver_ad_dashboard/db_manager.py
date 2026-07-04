import sqlite3
import os

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "naver_ads.db")

def get_connection():
    """Returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema and creates necessary indexes."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create main reports table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            date TEXT,
            ad_type TEXT,
            campaign_id TEXT,
            campaign_name TEXT,
            adgroup_id TEXT,
            adgroup_name TEXT,
            keyword TEXT,
            search_query TEXT,
            impressions INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            cost INTEGER DEFAULT 0,
            cpc REAL DEFAULT 0,
            search_volume INTEGER DEFAULT 0,
            PRIMARY KEY (date, ad_type, campaign_id, adgroup_id, keyword, search_query)
        )
    """)
    
    # Indexes to speed up date-range queries and keyword filtering
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_date ON reports (date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_ad_type ON reports (ad_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_keyword ON reports (keyword)")
    
    # Audit log table to track synced dates
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_log (
            date TEXT,
            ad_type TEXT,
            report_type TEXT, -- 'KEYWORD' or 'USER_RETURN'
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (date, ad_type, report_type)
        )
    """)
    
    conn.commit()
    conn.close()

def save_report_data(data_rows):
    """
    Saves report rows to the database using UPSERT.
    Each row should be a tuple or list matching the database fields.
    """
    if not data_rows:
        return
        
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.executemany("""
        INSERT OR REPLACE INTO reports (
            date, ad_type, campaign_id, campaign_name, adgroup_id, adgroup_name,
            keyword, search_query, impressions, clicks, cost, cpc, search_volume
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            COALESCE((SELECT search_volume FROM reports WHERE keyword = ? LIMIT 1), 0)
        )
    """, [(
        r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[6]
    ) for r in data_rows])
    
    conn.commit()
    conn.close()

def update_search_volumes(volume_dict):
    """
    Updates the search_volume field for given keywords.
    volume_dict: {keyword: search_volume}
    """
    if not volume_dict:
        return
        
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.executemany("""
        UPDATE reports 
        SET search_volume = ? 
        WHERE keyword = ?
    """, [(vol, kw) for kw, vol in volume_dict.items()])
    
    conn.commit()
    conn.close()

def log_sync(date_str, ad_type, report_type):
    """Logs a successful sync for a specific date and type."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO sync_log (date, ad_type, report_type)
        VALUES (?, ?, ?)
    """, (date_str, ad_type, report_type))
    conn.commit()
    conn.close()

def get_synced_dates(ad_type, report_type):
    """Returns a set of dates that have already been synced for a given ad and report type."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT date FROM sync_log 
        WHERE ad_type = ? AND report_type = ?
    """, (ad_type, report_type))
    rows = cursor.fetchall()
    conn.close()
    return {row['date'] for row in rows}
