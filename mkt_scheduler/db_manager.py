import sqlite3
import json
from datetime import datetime
from pathlib import Path
from .config import DB_PATH, STATIC_JSON_PATH

def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS daily_media_summary (
        date TEXT NOT NULL,
        media TEXT NOT NULL,
        spend INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        cpc REAL DEFAULT 0.0,
        ctr REAL DEFAULT 0.0,
        PRIMARY KEY (date, media)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS keyword_performance (
        date TEXT NOT NULL,
        keyword TEXT NOT NULL,
        media TEXT NOT NULL,
        campaign TEXT DEFAULT '',
        adgroup TEXT DEFAULT '',
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        spend INTEGER DEFAULT 0,
        cpc REAL DEFAULT 0.0,
        ctr REAL DEFAULT 0.0,
        PRIMARY KEY (date, keyword, media, campaign, adgroup)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT
    )
    """)

    conn.commit()
    conn.close()

def save_daily_media_records(records):
    """
    records: list of dicts:
    [{'date': 'YYYY-MM-DD', 'media': '...', 'spend': ..., 'impressions': ..., 'clicks': ..., 'cpc': ..., 'ctr': ...}]
    """
    if not records:
        return
    conn = get_connection()
    cur = conn.cursor()
    for r in records:
        spend = int(r.get('spend') or 0)
        impr = int(r.get('impressions') or 0)
        clicks = int(r.get('clicks') or 0)
        cpc = float(r.get('cpc') or (round(spend / clicks, 1) if clicks > 0 else 0.0))
        ctr = float(r.get('ctr') or (round((clicks / impr) * 100, 2) if impr > 0 else 0.0))
        cur.execute("""
            INSERT INTO daily_media_summary (date, media, spend, impressions, clicks, cpc, ctr)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, media) DO UPDATE SET
                spend = excluded.spend,
                impressions = excluded.impressions,
                clicks = excluded.clicks,
                cpc = excluded.cpc,
                ctr = excluded.ctr
        """, (r['date'], r['media'], spend, impr, clicks, cpc, ctr))
    conn.commit()
    conn.close()

def save_keyword_records(records):
    """
    records: list of dicts
    """
    if not records:
        return
    conn = get_connection()
    cur = conn.cursor()
    for r in records:
        spend = int(r.get('spend') or 0)
        impr = int(r.get('impressions') or 0)
        clicks = int(r.get('clicks') or 0)
        cpc = float(r.get('cpc') or (round(spend / clicks, 1) if clicks > 0 else 0.0))
        ctr = float(r.get('ctr') or (round((clicks / impr) * 100, 2) if impr > 0 else 0.0))
        cur.execute("""
            INSERT INTO keyword_performance (date, keyword, media, campaign, adgroup, impressions, clicks, spend, cpc, ctr)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, keyword, media, campaign, adgroup) DO UPDATE SET
                impressions = excluded.impressions,
                clicks = excluded.clicks,
                spend = excluded.spend,
                cpc = excluded.cpc,
                ctr = excluded.ctr
        """, (r['date'], r['keyword'], r['media'], r.get('campaign', ''), r.get('adgroup', ''), impr, clicks, spend, cpc, ctr))
    conn.commit()
    conn.close()

def log_event(event_type, status, message):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO sync_logs (timestamp, type, status, message)
        VALUES (?, ?, ?, ?)
    """, (datetime.now().isoformat(), event_type, status, str(message)))
    conn.commit()
    conn.close()

def get_period_stats(start_date, end_date):
    """
    Computes aggregated performance between start_date and end_date (inclusive).
    Returns dict with total metrics and per-channel breakdown.
    """
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT media,
               SUM(spend) as total_spend,
               SUM(impressions) as total_impr,
               SUM(clicks) as total_clicks
        FROM daily_media_summary
        WHERE date >= ? AND date <= ?
        GROUP BY media
    """, (start_date, end_date))

    rows = cur.fetchall()

    total_spend = 0
    total_impr = 0
    total_clicks = 0
    media_breakdown = {}

    for row in rows:
        m = row['media']
        s = int(row['total_spend'] or 0)
        i = int(row['total_impr'] or 0)
        c = int(row['total_clicks'] or 0)
        cpc = round(s / c, 1) if c > 0 else 0
        ctr = round((c / i) * 100, 2) if i > 0 else 0.0

        total_spend += s
        total_impr += i
        total_clicks += c

        media_breakdown[m] = {
            'spend': s,
            'impressions': i,
            'clicks': c,
            'cpc': cpc,
            'ctr': ctr
        }

    cur.execute("""
        SELECT media, keyword, SUM(clicks) as k_clicks, SUM(spend) as k_spend, SUM(impressions) as k_impr
        FROM keyword_performance
        WHERE date >= ? AND date <= ? AND clicks > 0
        GROUP BY media, keyword
        ORDER BY k_clicks DESC, k_spend DESC
    """, (start_date, end_date))
    kw_rows = cur.fetchall()
    conn.close()

    keywords_by_media = {}
    for kr in kw_rows:
        km = kr['media']
        if km not in keywords_by_media:
            keywords_by_media[km] = []
        c = int(kr['k_clicks'] or 0)
        s = int(kr['k_spend'] or 0)
        keywords_by_media[km].append({
            'keyword': kr['keyword'],
            'clicks': c,
            'spend': s,
            'cpc': round(s / c) if c > 0 else 0
        })

    for m in media_breakdown:
        media_breakdown[m]['top_keywords'] = keywords_by_media.get(m, [])

    overall_cpc = round(total_spend / total_clicks) if total_clicks > 0 else 0
    overall_ctr = round((total_clicks / total_impr) * 100, 2) if total_impr > 0 else 0.0

    return {
        'start_date': start_date,
        'end_date': end_date,
        'has_data': len(rows) > 0,
        'total_spend': total_spend,
        'total_impressions': total_impr,
        'total_clicks': total_clicks,
        'avg_cpc': overall_cpc,
        'avg_ctr': overall_ctr,
        'breakdown': media_breakdown
    }

def build_export_json():
    """
    Compiles complete SQLite data into the structured JSON expected by /mkt frontend and KV.
    """
    conn = get_connection()
    cur = conn.cursor()

    # 1. Daily records grouped by date
    cur.execute("SELECT * FROM daily_media_summary ORDER BY date ASC")
    rows = cur.fetchall()

    daily_dict = {}
    for r in rows:
        d = r['date']
        m = r['media']
        if d not in daily_dict:
            daily_dict[d] = {
                'spend': 0,
                'impressions': 0,
                'clicks': 0,
                'cpc': 0,
                'ctr': 0,
                'naver': {
                    'spend': 0, 'impressions': 0, 'clicks': 0, 'cpc': 0,
                    'powerlink': {'spend': 0, 'clicks': 0, 'impressions': 0},
                    'powercontents': {'spend': 0, 'clicks': 0, 'impressions': 0},
                    'place': {'spend': 0, 'clicks': 0, 'impressions': 0}
                },
                'google': {'spend': 0, 'impressions': 0, 'clicks': 0, 'cpc': 0}
            }

        spend = int(r['spend'] or 0)
        impr = int(r['impressions'] or 0)
        clicks = int(r['clicks'] or 0)

        daily_dict[d]['spend'] += spend
        daily_dict[d]['impressions'] += impr
        daily_dict[d]['clicks'] += clicks

        if m == 'NAVER_POWERLINK':
            daily_dict[d]['naver']['spend'] += spend
            daily_dict[d]['naver']['impressions'] += impr
            daily_dict[d]['naver']['clicks'] += clicks
            daily_dict[d]['naver']['powerlink'] = {'spend': spend, 'clicks': clicks, 'impressions': impr}
        elif m == 'NAVER_POWERCONTENTS':
            daily_dict[d]['naver']['spend'] += spend
            daily_dict[d]['naver']['impressions'] += impr
            daily_dict[d]['naver']['clicks'] += clicks
            daily_dict[d]['naver']['powercontents'] = {'spend': spend, 'clicks': clicks, 'impressions': impr}
        elif m == 'NAVER_PLACE':
            daily_dict[d]['naver']['spend'] += spend
            daily_dict[d]['naver']['impressions'] += impr
            daily_dict[d]['naver']['clicks'] += clicks
            daily_dict[d]['naver']['place'] = {'spend': spend, 'clicks': clicks, 'impressions': impr}
        elif m == 'GOOGLE_SA':
            daily_dict[d]['google']['spend'] += spend
            daily_dict[d]['google']['impressions'] += impr
            daily_dict[d]['google']['clicks'] += clicks
            daily_dict[d]['google']['cpc'] = round(spend / clicks) if clicks > 0 else 0

    # Recalculate daily totals and averages
    for d, item in daily_dict.items():
        if item['clicks'] > 0:
            item['cpc'] = round(item['spend'] / item['clicks'])
        if item['impressions'] > 0:
            item['ctr'] = round((item['clicks'] / item['impressions']) * 100, 2)
        if item['naver']['clicks'] > 0:
            item['naver']['cpc'] = round(item['naver']['spend'] / item['naver']['clicks'])

    # 2. Aggregated Keywords
    cur.execute("""
        SELECT keyword, media, campaign, adgroup,
               SUM(impressions) as total_impr,
               SUM(clicks) as total_clicks,
               SUM(spend) as total_spend
        FROM keyword_performance
        GROUP BY keyword, media, campaign, adgroup
        ORDER BY total_spend DESC
    """)
    kw_rows = cur.fetchall()
    conn.close()

    keywords_list = []
    for k in kw_rows:
        s = int(k['total_spend'] or 0)
        i = int(k['total_impr'] or 0)
        c = int(k['total_clicks'] or 0)
        cpc = round(s / c) if c > 0 else 0
        ctr = round((c / i) * 100, 2) if i > 0 else 0.0
        keywords_list.append({
            'keyword': k['keyword'],
            'media': k['media'],
            'campaign': k['campaign'],
            'group': k['adgroup'],
            'impressions': i,
            'clicks': c,
            'ctr': ctr,
            'cpc': cpc,
            'spend': s
        })

    # Overall Summary
    total_spend = sum(x['spend'] for x in daily_dict.values())
    total_impr = sum(x['impressions'] for x in daily_dict.values())
    total_clicks = sum(x['clicks'] for x in daily_dict.values())
    naver_spend = sum(x['naver']['spend'] for x in daily_dict.values())
    google_spend = sum(x['google']['spend'] for x in daily_dict.values())

    payload = {
        'updated_at': datetime.now().isoformat(),
        'summary': {
            'total_spend': total_spend,
            'total_impressions': total_impr,
            'total_clicks': total_clicks,
            'avg_cpc': round(total_spend / total_clicks) if total_clicks > 0 else 0,
            'avg_ctr': round((total_clicks / total_impr) * 100, 2) if total_impr > 0 else 0.0,
            'naver_spend': naver_spend,
            'google_spend': google_spend
        },
        'daily': daily_dict,
        'keywords': keywords_list
    }

    return payload
