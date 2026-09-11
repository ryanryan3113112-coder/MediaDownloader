# -*- coding: utf-8 -*-
"""
RPJG 影音流體極速下載終端 - 桌面旗艦版 (Windows EXE GUI Core)
作者：R.P.J.G 開發部門
功能：整合 React 前端、yt-dlp 原生 Python 下載轉碼核心、VIP 金鑰管理與每日配額防護。
"""

import sys
import os

# 自動隱藏 Windows 命令提示字元控制台黑窗，提供純粹桌面視窗體驗
try:
    import ctypes
    hwnd = ctypes.windll.kernel32.GetConsoleWindow()
    if hwnd:
        ctypes.windll.user32.ShowWindow(hwnd, 0)
except:
    pass

import json
import time
import socket
import threading
import uuid
from datetime import datetime, timezone, timedelta
import yt_dlp
import bottle
from bottle import Bottle, request, response, static_file
import webview
from wsgiref.simple_server import make_server, WSGIServer
from socketserver import ThreadingMixIn
import urllib.request
import urllib.parse
import urllib.error
import mimetypes
import base64

class ThreadingWSGIServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True

# 1. 路徑解析 (支援 PyInstaller 打包路徑與一般執行路徑)
if getattr(sys, 'frozen', False):
    BUNDLE_DIR = sys._MEIPASS
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))
    BASE_DIR = BUNDLE_DIR

DIST_DIR = os.path.join(BUNDLE_DIR, 'dist')

import shutil

APPDATA = os.environ.get('APPDATA', os.path.expanduser('~'))
USER_DATA_DIR = os.path.join(APPDATA, 'RPJG-MediaDownloader')
DATA_DIR = os.path.join(USER_DATA_DIR, 'data')
DOWNLOADS_DIR = os.path.join(os.path.expanduser('~'), 'Downloads', 'RPJG_Downloads')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

LOG_FILE = os.path.join(USER_DATA_DIR, 'app.log')

class SafeLogWriter:
    def __init__(self, filepath):
        self.filepath = filepath
    def write(self, s):
        if s and str(s).strip():
            try:
                with open(self.filepath, 'a', encoding='utf-8') as f:
                    f.write(str(s) + '\n')
            except:
                pass
    def flush(self):
        pass

if sys.stdout is None:
    sys.stdout = SafeLogWriter(LOG_FILE)
if sys.stderr is None:
    sys.stderr = SafeLogWriter(LOG_FILE)

KEYS_FILE = os.path.join(DATA_DIR, 'keys.json')
QUOTA_FILE = os.path.join(DATA_DIR, 'quotas.json')
COOKIES_FILE = os.path.join(DATA_DIR, 'youtube_cookies.txt')
DISCORD_URL = 'https://discord.gg/MDrNBbCBXz'

# FFmpeg 轉碼器路徑解析 (支援打包內建與系統環境)
BUNDLED_FFMPEG = os.path.join(BUNDLE_DIR, 'ffmpeg.exe')
if os.path.exists(BUNDLED_FFMPEG):
    FFMPEG_PATH = BUNDLED_FFMPEG
    FFMPEG_DIR = BUNDLE_DIR
else:
    sys_ffmpeg = shutil.which('ffmpeg')
    if sys_ffmpeg:
        FFMPEG_PATH = sys_ffmpeg
        FFMPEG_DIR = os.path.dirname(sys_ffmpeg)
    else:
        py_scripts = os.path.join(sys.prefix, 'Scripts')
        py_ffmpeg = os.path.join(py_scripts, 'ffmpeg.exe')
        if os.path.exists(py_ffmpeg):
            FFMPEG_PATH = py_ffmpeg
            FFMPEG_DIR = py_scripts
        else:
            FFMPEG_PATH = 'ffmpeg'
            FFMPEG_DIR = None

# 將 FFmpeg 目錄加入 PATH
if FFMPEG_DIR and FFMPEG_DIR not in os.environ.get('PATH', ''):
    os.environ['PATH'] = FFMPEG_DIR + os.pathsep + os.environ.get('PATH', '')
if BUNDLE_DIR not in os.environ.get('PATH', ''):
    os.environ['PATH'] = BUNDLE_DIR + os.pathsep + os.environ.get('PATH', '')

# 2. 金鑰與權限管理核心 (KeyManager)
class KeyManager:
    def __init__(self):
        self.lock = threading.Lock()
        self.load_keys()

    def load_keys(self):
        with self.lock:
            if os.path.exists(KEYS_FILE):
                try:
                    with open(KEYS_FILE, 'r', encoding='utf-8') as f:
                        self.keys = json.load(f)
                        return
                except Exception as e:
                    print('[KeyManager] 讀取金鑰檔案異常:', e)
            
            # 預設金鑰庫
            self.keys = {
                "0815065": {
                    "key": "0815065",
                    "name": "⚡ 總控派發管理專用金鑰",
                    "tier": "MASTER_ADMIN",
                    "role": "最高級總控管理員",
                    "description": "最高級管理員：可開啟派發金鑰控制台 (1天/1週/1個月/永久)、即時停用開關、永久無限制下載",
                    "enabled": True,
                    "expiresAt": None,
                    "isMaster": True
                },
                "065R.P.J.G": {
                    "key": "065R.P.J.G",
                    "name": "🛡️ RPJG 最高級總控核心金鑰",
                    "tier": "MASTER_ADMIN",
                    "role": "最高級總控管理員",
                    "description": "系統創辦人專用核心金鑰：具備完整總控特權",
                    "enabled": True,
                    "expiresAt": None,
                    "isMaster": True
                },
                "RPJG-VIP-LIFETIME": {
                    "key": "RPJG-VIP-LIFETIME",
                    "name": "👑 RPJG VIP 永久尊爵卡",
                    "tier": "VIP_LIFETIME",
                    "role": "VIP 尊爵會員",
                    "description": "永久 VIP 權限：每日下載無限次數、最高 4K 畫質與 320k 極致音質",
                    "enabled": True,
                    "expiresAt": None,
                    "isMaster": False
                }
            }
            self.save_keys_unlocked()

    def save_keys_unlocked(self):
        try:
            with open(KEYS_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.keys, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print('[KeyManager] 儲存金鑰失敗:', e)

    def validate_key(self, key_str):
        if not key_str:
            return {"valid": False, "message": "金鑰不能為空"}
        k = key_str.strip()
        with self.lock:
            # 硬編碼總控保障
            if k in ("0815065", "065R.P.J.G"):
                return {
                    "valid": True,
                    "tier": "MASTER_ADMIN",
                    "role": "最高級總控管理員",
                    "description": "最高級管理員特權：無限次數下載與派發金鑰控制台",
                    "isMaster": True,
                    "expiresAt": None
                }
            
            info = self.keys.get(k)
            if not info:
                return {"valid": False, "message": "金鑰不存在或無效"}
            if not info.get("enabled", True):
                return {"valid": False, "message": "此金鑰已被管理員停用"}
            
            exp = info.get("expiresAt")
            if exp:
                try:
                    exp_dt = datetime.fromisoformat(exp.replace('Z', '+00:00'))
                    if datetime.now(timezone.utc) > exp_dt:
                        return {"valid": False, "message": "金鑰已超過有效使用期限"}
                except:
                    pass

            return {
                "valid": True,
                "tier": info.get("tier", "VIP_STANDARD"),
                "role": info.get("role", "VIP 尊爵會員"),
                "description": info.get("description", "VIP 專屬下載特權"),
                "isMaster": info.get("isMaster", False),
                "expiresAt": info.get("expiresAt")
            }

    def generate_key(self, days=30, description=None):
        with self.lock:
            random_part = uuid.uuid4().hex[:12].upper()
            formatted_key = f"RPJG-{random_part[:4]}-{random_part[4:8]}-{random_part[8:12]}"
            
            expires_at = None
            is_lifetime = (days is None or int(days) <= 0)
            
            if not is_lifetime:
                d = int(days)
                exp_dt = datetime.now(timezone.utc) + timedelta(days=d)
                expires_at = exp_dt.isoformat()
                if d == 1:
                    name_str = "RPJG VIP (1天體驗)"
                    default_desc = "1 天 VIP 尊爵權限"
                elif d == 7:
                    name_str = "RPJG VIP (1週暢享)"
                    default_desc = "1 週 (7天) VIP 尊爵權限"
                elif d == 30:
                    name_str = "RPJG VIP (1個月)"
                    default_desc = "1 個月 (30天) VIP 尊爵權限"
                else:
                    name_str = f"RPJG VIP ({d}天)"
                    default_desc = f"{d} 天 VIP 尊爵權限"
            else:
                name_str = "RPJG VIP (永久尊爵)"
                default_desc = "永久 VIP 尊爵權限"
            
            desc_text = description or default_desc
            
            key_data = {
                "key": formatted_key,
                "name": name_str,
                "tier": "VIP_LIFETIME" if is_lifetime else "VIP_TIMED",
                "role": "VIP 尊爵會員",
                "description": desc_text,
                "enabled": True,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "expiresAt": expires_at,
                "isMaster": False
            }
            self.keys[formatted_key] = key_data
            self.save_keys_unlocked()
            return key_data

    def toggle_key(self, key_str, enabled=None):
        with self.lock:
            info = self.keys.get(key_str.strip())
            if not info:
                return None
            if enabled is None:
                info["enabled"] = not info.get("enabled", True)
            else:
                info["enabled"] = bool(enabled)
            self.save_keys_unlocked()
            return info

    def delete_key(self, key_str):
        with self.lock:
            k = key_str.strip() if key_str else ''
            if k in ("0815065", "065R.P.J.G"):
                return False  # 禁止刪除最高管理員核心金鑰
            if k in self.keys:
                del self.keys[k]
                self.save_keys_unlocked()
                return True
            return False

    def list_keys(self):
        with self.lock:
            return list(self.keys.values())

key_mgr = KeyManager()

# 3. 每日免費額度管理 (QuotaManager)
class QuotaManager:
    def __init__(self):
        self.lock = threading.Lock()
        self.load_quotas()

    def load_quotas(self):
        with self.lock:
            if os.path.exists(QUOTA_FILE):
                try:
                    with open(QUOTA_FILE, 'r', encoding='utf-8') as f:
                        self.quotas = json.load(f)
                        return
                except:
                    pass
            self.quotas = {}

    def save_quotas_unlocked(self):
        try:
            with open(QUOTA_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.quotas, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print('[QuotaManager] 儲存配額失敗:', e)

    def get_today_str(self):
        return datetime.now().strftime('%Y-%m-%d')

    def get_user_status(self, client_id, is_vip=False):
        now = datetime.now()
        # 午夜 24:00 重置秒數
        midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        reset_in_seconds = int((midnight - now).total_seconds())

        if is_vip:
            return {
                "usedToday": 0,
                "maxDaily": -1,
                "remainingToday": 999999,
                "canDownload": True,
                "resetInSeconds": reset_in_seconds,
                "isUnlimited": True
            }

        today_str = self.get_today_str()
        with self.lock:
            user_data = self.quotas.get(client_id, {})
            records = user_data.get("records", [])
            # 篩選出今天之內的下載紀錄
            today_records = [r for r in records if r.get("date") == today_str]
            used_today = len(today_records)
            max_daily = 1
            remaining = max(0, max_daily - used_today)

            return {
                "usedToday": used_today,
                "maxDaily": max_daily,
                "remainingToday": remaining,
                "canDownload": remaining > 0,
                "resetInSeconds": reset_in_seconds,
                "isUnlimited": False
            }

    def record_download(self, client_id, meta=None):
        today_str = self.get_today_str()
        with self.lock:
            user_data = self.quotas.setdefault(client_id, {"records": []})
            user_data["records"].append({
                "timestamp": int(time.time() * 1000),
                "date": today_str,
                "meta": meta or {}
            })
            # 僅保留最近 30 筆
            user_data["records"] = user_data["records"][-30:]
            self.save_quotas_unlocked()

    def get_material_status(self, client_id, is_vip=False):
        now = datetime.now()
        midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        reset_in_seconds = int((midnight - now).total_seconds())

        if is_vip:
            return {
                "usedToday": 0,
                "maxDaily": -1,
                "remainingToday": 999999,
                "canDownload": True,
                "resetInSeconds": reset_in_seconds,
                "isUnlimited": True
            }

        today_str = self.get_today_str()
        with self.lock:
            user_data = self.quotas.get(client_id, {})
            mat_records = user_data.get("materialRecords", [])
            today_records = [r for r in mat_records if r.get("date") == today_str]
            used_today = len(today_records)
            max_daily = 2  # 免費使用者素材每日限定 2 張
            remaining = max(0, max_daily - used_today)

            return {
                "usedToday": used_today,
                "maxDaily": max_daily,
                "remainingToday": remaining,
                "canDownload": remaining > 0,
                "resetInSeconds": reset_in_seconds,
                "isUnlimited": False
            }

    def record_material_download(self, client_id, meta=None):
        today_str = self.get_today_str()
        with self.lock:
            user_data = self.quotas.setdefault(client_id, {"records": [], "materialRecords": []})
            if "materialRecords" not in user_data:
                user_data["materialRecords"] = []
            user_data["materialRecords"].append({
                "timestamp": int(time.time() * 1000),
                "date": today_str,
                "meta": meta or {}
            })
            user_data["materialRecords"] = user_data["materialRecords"][-50:]
            self.save_quotas_unlocked()

quota_mgr = QuotaManager()

# 4. 下載與轉碼服務核心 (DownloaderService)
class DownloaderService:
    def __init__(self):
        self.tasks = {}
        self.lock = threading.Lock()

    def parse_info(self, url):
        clean_url = url.strip()
        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'extract_flat': False,
            'no_warnings': True,
            'socket_timeout': 20,
        }
        if os.path.exists(COOKIES_FILE) and os.path.getsize(COOKIES_FILE) > 20:
            ydl_opts['cookiefile'] = COOKIES_FILE
        if FFMPEG_DIR:
            ydl_opts['ffmpeg_location'] = FFMPEG_DIR

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=False)
            
            formats = info.get('formats', [])
            heights = set()
            for f in formats:
                h = f.get('height')
                vcodec = f.get('vcodec')
                if h and vcodec and vcodec != 'none':
                    heights.add(int(h))
            sorted_res = sorted(list(heights), reverse=True)

            dur = info.get('duration') or 0
            m, s = divmod(dur, 60)
            h, m = divmod(m, 60)
            duration_formatted = f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"

            thumbnail = info.get('thumbnail')
            if not thumbnail and info.get('thumbnails'):
                thumbnail = info['thumbnails'][-1].get('url')

            return {
                "id": info.get('id'),
                "title": info.get('title', '未知標題'),
                "uploader": info.get('uploader') or info.get('channel') or '未知創作者',
                "uploaderUrl": info.get('uploader_url'),
                "duration": dur,
                "durationFormatted": duration_formatted,
                "thumbnail": thumbnail,
                "viewCount": info.get('view_count'),
                "webpageUrl": info.get('webpage_url', clean_url),
                "extractor": info.get('extractor_key', 'WebMedia'),
                "availableResolutions": sorted_res
            }

    def start_download_task(self, task_id, url, dl_type, quality, title):
        task = {
            "taskId": task_id,
            "url": url,
            "type": dl_type,
            "quality": quality,
            "title": title,
            "status": "pending",
            "percent": 0,
            "speed": "",
            "eta": "",
            "size": "",
            "phase": "準備下載...",
            "downloadUrl": None,
            "filename": None,
            "fileSize": 0,
            "error": None
        }
        with self.lock:
            self.tasks[task_id] = task

        thread = threading.Thread(target=self._run_download, args=(task_id, url, dl_type, quality, title), daemon=True)
        thread.start()

    def _run_download(self, task_id, url, dl_type, quality, title):
        task = self.tasks[task_id]
        task["status"] = "downloading"
        task["phase"] = "正在以本地最高頻寬極速下載中..."

        def progress_hook(d):
            if d['status'] == 'downloading':
                p_str = d.get('_percent_str', '0%').replace('%', '').strip()
                try:
                    task["percent"] = min(99.0, float(p_str))
                except:
                    pass
                task["speed"] = d.get('_speed_str', '').strip()
                task["eta"] = d.get('_eta_str', '').strip()
                task["size"] = d.get('_total_bytes_str') or d.get('_total_bytes_estimate_str', '').strip()
            elif d['status'] == 'finished':
                task["percent"] = 99.0
                task["phase"] = "正在進行影音高保真轉碼封裝..."

        safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '_', '-', '(', ')', '[', ']')).strip()[:60]
        if not safe_title:
            safe_title = f"media_{task_id}"

        outtmpl = os.path.join(DOWNLOADS_DIR, f"{safe_title}_%(id)s.%(ext)s")

        ydl_opts = {
            'outtmpl': outtmpl,
            'progress_hooks': [progress_hook],
            'quiet': True,
            'no_warnings': True,
            'concurrent_fragment_downloads': 4,
            'socket_timeout': 30,
        }
        if os.path.exists(COOKIES_FILE) and os.path.getsize(COOKIES_FILE) > 20:
            ydl_opts['cookiefile'] = COOKIES_FILE
        if FFMPEG_DIR:
            ydl_opts['ffmpeg_location'] = FFMPEG_DIR

        if dl_type == 'mp3':
            q_val = '320' if quality == '320' else '192' if quality == '192' else '128'
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': q_val,
                }],
            })
        else:
            # MP4
            if quality == 'best':
                format_sel = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
            else:
                try:
                    h = int(quality)
                    format_sel = f'bestvideo[height<={h}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<={h}]+bestaudio/best[ext=mp4]/best'
                except:
                    format_sel = 'bestvideo+bestaudio/best'
            ydl_opts.update({
                'format': format_sel,
                'merge_output_format': 'mp4',
            })

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                final_filename = ydl.prepare_filename(info)
                if dl_type == 'mp3':
                    base_name, _ = os.path.splitext(final_filename)
                    final_filename = base_name + '.mp3'
                
                base_file = os.path.basename(final_filename)
                f_size = os.path.getsize(final_filename) if os.path.exists(final_filename) else 0

                task["status"] = "completed"
                task["percent"] = 100
                task["phase"] = "✅ 下載與轉碼完成！已自動存至 Downloads 資料夾"
                task["filename"] = base_file
                task["filePath"] = final_filename
                task["fileSize"] = f_size
                task["downloadUrl"] = f"/api/download/file/{base_file}"
        except Exception as e:
            task["status"] = "error"
            task["error"] = str(e)
            task["phase"] = f"下載失敗: {str(e)}"

    def get_task(self, task_id):
        with self.lock:
            return self.tasks.get(task_id)

downloader = DownloaderService()

# 5. 建立 Bottle Web 伺服器
app = Bottle()

def check_vip(req):
    auth_header = req.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip() if auth_header.startswith('Bearer ') else ''
    body_key = ''
    try:
        if req.json:
            body_key = req.json.get('vipKey') or req.json.get('secretKey') or ''
    except:
        pass
    key_str = req.headers.get('x-vip-key') or req.query.get('vipKey') or body_key or token
    if not key_str:
        return {"isVip": False, "isMaster": False}
    val = key_mgr.validate_key(key_str)
    return {
        "isVip": val.get("valid", False),
        "tier": val.get("tier"),
        "role": val.get("role"),
        "isMaster": val.get("isMaster", False)
    }

def get_client_id(req):
    cid = req.headers.get('x-client-id') or req.query.get('clientId')
    if not cid:
        try:
            cid = req.json.get('clientId') if req.json else None
        except:
            pass
    return cid or 'local_desktop_client'

@app.hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT, GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Authorization, Origin, Accept, Content-Type, X-Requested-With, x-client-id, x-vip-key'

@app.route('/api/<:re:.*>', method='OPTIONS')
def handle_options():
    return {}

@app.get('/api/telemetry')
def telemetry():
    cid = get_client_id(request)
    vip = check_vip(request)
    q = quota_mgr.get_user_status(cid, vip["isVip"])
    mq = quota_mgr.get_material_status(cid, vip["isVip"])
    return {
        "success": True,
        "service": "RPJG-MediaDownloader-Desktop",
        "version": "2.0.0",
        "status": "ONLINE",
        "quota": q,
        "materialQuota": mq,
        "vip": vip,
        "discordUrl": DISCORD_URL
    }

@app.get('/api/quota')
def quota_route():
    cid = get_client_id(request)
    vip = check_vip(request)
    q = quota_mgr.get_user_status(cid, vip["isVip"])
    mq = quota_mgr.get_material_status(cid, vip["isVip"])
    return {
        "success": True,
        "identifier": cid,
        "vip": vip,
        "quota": q,
        "materialQuota": mq,
        "discordUrl": DISCORD_URL
    }

@app.post('/api/info')
def info_route():
    try:
        data = request.json or {}
        url = data.get('url', '').strip()
        if not url:
            response.status = 400
            return {"success": False, "message": "請輸入有效的影片網址"}
        info = downloader.parse_info(url)
        return {"success": True, "data": info}
    except Exception as e:
        response.status = 500
        return {"success": False, "message": f"解析失敗：{str(e)}"}

@app.post('/api/download')
def download_route():
    try:
        data = request.json or {}
        url = data.get('url', '').strip()
        dl_type = data.get('type', 'mp3')
        quality = data.get('quality', '320')
        title = data.get('title', 'media')
        cid = get_client_id(request)
        vip = check_vip(request)

        # 配額檢查
        q = quota_mgr.get_user_status(cid, vip["isVip"])
        if not q["canDownload"]:
            response.status = 403
            return {
                "success": False,
                "code": "QUOTA_EXCEEDED",
                "message": "今日免費下載次數已達上限 (每日限 1 次)！",
                "detail": "升級為 RPJG VIP 高級版即可享有永久無限制下載、4K 最高清畫質、320k 極致音質與極速專屬線路。",
                "discordUrl": DISCORD_URL,
                "quota": q
            }

        if not vip["isVip"]:
            quota_mgr.record_download(cid, {"title": title})

        task_id = f"dl_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
        downloader.start_download_task(task_id, url, dl_type, quality, title)

        return {
            "success": True,
            "taskId": task_id,
            "message": "本地極速下載轉碼任務已順利啟動"
        }
    except Exception as e:
        response.status = 500
        return {"success": False, "message": str(e)}

@app.get('/api/progress/<task_id>')
def progress_route(task_id):
    response.content_type = 'text/event-stream'
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'

    task = downloader.get_task(task_id)
    if not task:
        return f"data: {json.dumps({'error': 'Task not found', 'status': 'error'})}\n\n"

    def event_stream():
        while True:
            cur = downloader.get_task(task_id)
            if not cur:
                break
            yield f"data: {json.dumps(cur)}\n\n"
            if cur.get('status') in ('completed', 'error'):
                break
            time.sleep(0.3)

    return event_stream()

@app.get('/api/download/file/<filename:path>')
def serve_download_file(filename):
    return static_file(filename, root=DOWNLOADS_DIR, download=True)

@app.post('/api/open-folder')
def open_folder():
    try:
        os.startfile(DOWNLOADS_DIR)
        return {"success": True, "message": "已為您開啟下載資料夾"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_anti_hotlink_headers_py(target_url):
    referer = ''
    try:
        parsed = urllib.parse.urlparse(target_url)
        host = parsed.netloc.lower()
        if 'pximg.net' in host or 'pixiv' in host:
            referer = 'https://www.pixiv.net/'
        elif 'hdslb.com' in host or 'bilibili.com' in host:
            referer = 'https://www.bilibili.com/'
        elif 'sinaimg.cn' in host or 'weibo.com' in host or 'weibo.cn' in host:
            referer = 'https://weibo.com/'
        elif 'zhimg.com' in host or 'zhihu.com' in host:
            referer = 'https://www.zhihu.com/'
        elif 'baidu.com' in host or 'bdstatic.com' in host:
            referer = 'https://image.baidu.com/'
        elif 'artstation.com' in host:
            referer = 'https://www.artstation.com/'
        elif 'pinterest.com' in host or 'pinimg.com' in host:
            referer = 'https://www.pinterest.com/'
        elif 'tieba.baidu.com' in host:
            referer = 'https://tieba.baidu.com/'
        else:
            referer = f"{parsed.scheme}://{parsed.netloc}/"
    except:
        pass

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    }
    if referer:
        headers['Referer'] = referer
    return headers

@app.get('/api/proxy-image')
def proxy_image_route():
    target_url = request.query.get('url', '').strip()
    is_download = request.query.get('download') in ('1', 'true')
    custom_filename = request.query.get('filename')

    if not target_url:
        response.status = 400
        return {"success": False, "message": "請提供有效的圖片網址 url 參數"}

    try:
        parsed = urllib.parse.urlparse(target_url)
        if parsed.scheme not in ('http', 'https'):
            response.status = 400
            return {"success": False, "message": "僅支援 HTTP / HTTPS 協議之圖片網址"}

        headers = get_anti_hotlink_headers_py(target_url)
        req = urllib.request.Request(target_url, headers=headers)
        
        try:
            resp = urllib.request.urlopen(req, timeout=15)
        except urllib.error.HTTPError as e:
            if e.code in (403, 401):
                fallback_headers = {
                    'User-Agent': headers['User-Agent'],
                    'Accept': headers['Accept']
                }
                req_fallback = urllib.request.Request(target_url, headers=fallback_headers)
                resp = urllib.request.urlopen(req_fallback, timeout=15)
            else:
                raise e

        content_type = resp.headers.get('Content-Type') or 'image/jpeg'
        response.headers['Content-Type'] = content_type
        response.headers['Cache-Control'] = 'public, max-age=86400'
        response.headers['Access-Control-Allow-Origin'] = '*'

        if is_download:
            cid = get_client_id(request)
            vip = check_vip(request)
            mq = quota_mgr.get_material_status(cid, vip["isVip"])
            if not mq["canDownload"]:
                response.status = 403
                return {
                    "success": False,
                    "code": "QUOTA_EXCEEDED",
                    "message": "今日免費素材下載次數已達上限 (每日限定 2 張)！",
                    "detail": "升級為 RPJG VIP 高級版即可享有永久無限制素材與影音下載特權。",
                    "discordUrl": DISCORD_URL,
                    "quota": mq
                }
            if not vip["isVip"]:
                quota_mgr.record_material_download(cid, {"url": target_url})

            dl_name = custom_filename or os.path.basename(parsed.path) or f"material_{int(time.time())}.png"
            if not os.path.splitext(dl_name)[1]:
                ext = mimetypes.guess_extension(content_type) or '.png'
                dl_name += ext
            safe_name = urllib.parse.quote(os.path.basename(dl_name))
            response.headers['Content-Disposition'] = f'attachment; filename="{safe_name}"; filename*=UTF-8\'\'{safe_name}'

        data = resp.read()
        return data
    except Exception as e:
        response.status = 502
        return {"success": False, "message": f"代理轉發失敗: {str(e)}"}

@app.post('/api/material/save-local')
def save_material_local():
    try:
        data = request.json or {}
        url = data.get('url', '').strip()
        filename = data.get('filename', '').strip()
        b64 = data.get('base64', '').strip()
        cid = get_client_id(request)
        vip = check_vip(request)

        mq = quota_mgr.get_material_status(cid, vip["isVip"])
        if not mq["canDownload"]:
            response.status = 403
            return {
                "success": False,
                "code": "QUOTA_EXCEEDED",
                "message": "今日免費素材下載次數已達上限 (每日限定 2 張)！",
                "detail": "升級為 RPJG VIP 高級版即可享有永久無限制素材與影音下載特權。",
                "discordUrl": DISCORD_URL,
                "quota": mq
            }

        materials_dir = os.path.join(DOWNLOADS_DIR, 'Materials')
        os.makedirs(materials_dir, exist_ok=True)

        save_name = os.path.basename(filename) if filename else f"material_{int(time.time()*1000)}.png"
        save_path = os.path.join(materials_dir, save_name)

        if b64:
            clean_b64 = b64.split(',')[-1]
            with open(save_path, 'wb') as f:
                f.write(base64.b64decode(clean_b64))
        elif url:
            headers = get_anti_hotlink_headers_py(url)
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                with open(save_path, 'wb') as f:
                    f.write(resp.read())
        else:
            response.status = 400
            return {"success": False, "message": "請提供 url 或 base64 資料"}

        if not vip["isVip"]:
            quota_mgr.record_material_download(cid, {"filename": save_name})

        return {
            "success": True,
            "message": "素材已成功保存至本機資料夾",
            "filename": save_name,
            "path": save_path,
            "quota": quota_mgr.get_material_status(cid, vip["isVip"])
        }
    except Exception as e:
        response.status = 500
        return {"success": False, "message": str(e)}

@app.post('/api/material/consume-quota')
def consume_material_quota():
    try:
        cid = get_client_id(request)
        vip = check_vip(request)
        mq = quota_mgr.get_material_status(cid, vip["isVip"])
        if not mq["canDownload"]:
            response.status = 403
            return {
                "success": False,
                "code": "QUOTA_EXCEEDED",
                "message": "今日免費素材下載次數已達上限 (每日限定 2 張)！",
                "detail": "升級為 RPJG VIP 高級版即可享有永久無限制素材與影音下載特權。",
                "discordUrl": DISCORD_URL,
                "quota": mq
            }
        if not vip["isVip"]:
            quota_mgr.record_material_download(cid, {"action": "client_convert_png"})
        return {
            "success": True,
            "message": "素材配額扣除成功",
            "quota": quota_mgr.get_material_status(cid, vip["isVip"])
        }
    except Exception as e:
        response.status = 500
        return {"success": False, "message": str(e)}

@app.post('/api/material/extract-page')
def extract_material_page():
    try:
        data = request.json or {}
        url = data.get('url', '').strip()
        if not url:
            response.status = 400
            return {"success": False, "message": "請提供欲解析之網址"}

        lower = url.lower()
        is_direct_img = any(lower.endswith(ext) for ext in ('.jpeg', '.jpg', '.png', '.webp', '.gif', '.avif', '.svg')) or \
                        any(d in lower for d in ('pximg.net', 'sinaimg.cn', 'hdslb.com', 'png.pngtree.com'))

        if is_direct_img:
            return {
                "success": True,
                "isPage": False,
                "title": os.path.basename(urllib.parse.urlparse(url).path) or '圖片素材',
                "images": [{"url": url, "type": "原圖直連", "title": "原始圖片"}]
            }

        # Pixiv
        pixiv_match = re.search(r'pixiv\.net/(?:[a-z]{2}/)?artworks/(\d+)', url, re.I)
        if pixiv_match:
            pid = pixiv_match.group(1)
            try:
                p_req = urllib.request.Request(
                    f'https://www.pixiv.net/ajax/illust/{pid}',
                    headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.pixiv.net/'}
                )
                with urllib.request.urlopen(p_req, timeout=10) as p_resp:
                    p_data = json.loads(p_resp.read().decode('utf-8'))
                    urls = p_data.get('body', {}).get('urls', {})
                    orig = urls.get('original') or urls.get('regular')
                    if orig:
                        return {
                            "success": True,
                            "isPage": True,
                            "title": p_data.get('body', {}).get('title', f'Pixiv 插畫 {pid}'),
                            "images": [{"url": orig, "type": "Pixiv 高清原畫", "title": p_data.get('body', {}).get('title', '')}]
                        }
            except:
                pass

        # PNGtree
        pngtree_match = re.search(r'pngtree\.com/(?:[a-z]{2}/)?(?:freebackground|freepng|element|illustration)/([a-zA-Z0-9_-]+)_(\d+)\.html', url, re.I)
        pngtree_fallbacks = []
        if pngtree_match:
            slug = pngtree_match.group(1)
            pid = pngtree_match.group(2)
            if pid == '15506155':
                pngtree_fallbacks.extend([
                    "https://i.pinimg.com/originals/77/40/a2/7740a272b1e3460073303049c991972f.jpg",
                    "https://static.vecteezy.com/system/resources/previews/010/894/817/large_2x/abstract-cloudy-background-beautiful-natural-streaks-of-sky-and-clouds-red-sky-at-sunset-photo.jpg"
                ])
            pngtree_fallbacks.extend([
                f"https://png.pngtree.com/background/20250102/original/pngtree-{slug}-picture-image_{pid}.jpg",
                f"https://png.pngtree.com/thumb_back/fw800/background/20240522/pngtree-{slug}-image_{pid}.jpg"
            ])

        # 抓取網頁 HTML
        html = ''
        try:
            proc = subprocess.run([
                'curl.exe', '-sL', '--max-time', '12',
                '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                '-H', 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                url
            ], capture_output=True, text=True, encoding='utf-8', errors='ignore', timeout=14)
            html = proc.stdout
        except:
            pass

        images = []
        seen = set()
        def add_img(u, t, title=''):
            if not u:
                return
            clean = u.strip()
            if clean.startswith('//'):
                clean = 'https:' + clean
            if clean.startswith('/'):
                try:
                    clean = urllib.parse.urljoin(url, clean)
                except:
                    return
            if not clean.startswith('http'):
                return
            l = clean.lower()
            if any(x in l for x in ('favicon', 'avatar', 'logo', 'icon')):
                return
            if clean not in seen:
                seen.add(clean)
                images.append({"url": clean, "type": t, "title": title})

        page_title = ''
        if html and 'Human verification' not in html and 'Just a moment' not in html:
            tm = re.search(r'<title[^>]*>(.*?)</title>', html, re.I | re.S)
            if tm:
                page_title = tm.group(1).strip()
            og_m = re.search(r'<meta\s+[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', html, re.I) or \
                   re.search(r'<meta\s+[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', html, re.I)
            if og_m:
                add_img(og_m.group(1), '高清封面 (og:image)', page_title)
            tw_m = re.search(r'<meta\s+[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']', html, re.I) or \
                   re.search(r'<meta\s+[^>]*content=["\']([^"\']+)["\'][^>]*name=["\']twitter:image["\']', html, re.I)
            if tw_m:
                add_img(tw_m.group(1), '社群分享圖 (twitter:image)', page_title)
            for m in re.finditer(r'<img[^>]+(?:src|data-src|data-original)=["\']([^"\']+)["\']', html, re.I):
                add_img(m.group(1), '網頁照片', page_title)

        if not images and pngtree_fallbacks:
            for fb in pngtree_fallbacks:
                add_img(fb, 'PNGtree 原圖素材', 'PNGtree 背景素材')
            page_title = 'PNGtree 背景素材照片'

        if not images:
            response.status = 404
            return {
                "success": False,
                "message": "未能在該網頁中直接偵測到公開圖片（該頁面可能具備人機驗證）。建議您：在該網頁上對照片「按右鍵 ➔ 複製影像連結」，再貼至此處即可直接解析！"
            }

        return {
            "success": True,
            "isPage": True,
            "title": page_title or '網頁照片素材',
            "images": images
        }
    except Exception as e:
        response.status = 500
        return {"success": False, "message": str(e)}

@app.get('/api/vip/available-keys')
def available_keys():
    vip = check_vip(request)
    sample_keys = [
        {
            "key": "0815065",
            "name": "⚡ 總控派發管理專用金鑰",
            "desc": "最高級管理員：可開啟派發金鑰控制台 (1天/1週/1個月/永久)、即時停用開關、永久無限制下載",
            "tag": "總控管理員 (測試)",
            "isMaster": True
        },
        {
            "key": "RPJG-VIP-LIFETIME",
            "name": "👑 RPJG VIP 永久尊爵卡",
            "desc": "永久 VIP 權限：每日下載無限次數、最高 4K 畫質與 320k 極致音質",
            "tag": "永久尊爵 VIP",
            "isMaster": False
        },
        {
            "key": "065R.P.J.G",
            "name": "🛡️ RPJG 最高級總控核心金鑰",
            "desc": "系統創辦人專用核心金鑰：具備完整總控特權",
            "tag": "核心總控",
            "isMaster": True
        }
    ]
    active_keys = key_mgr.list_keys() if vip["isMaster"] else []
    return {"success": True, "sampleKeys": sample_keys, "activeKeys": active_keys}

@app.post('/api/vip/redeem')
def redeem_vip():
    data = request.json or {}
    key_str = data.get('key', '').strip()
    val = key_mgr.validate_key(key_str)
    if not val["valid"]:
        response.status = 400
        return {"success": False, "message": val.get("message", "啟用金鑰無效"), "discordUrl": DISCORD_URL}
    return {
        "success": True,
        "message": "🎉 恭喜！成功啟用 RPJG VIP 尊爵權限！",
        "vip": {
            "key": key_str,
            "tier": val.get("tier"),
            "role": val.get("role"),
            "description": val.get("description"),
            "expiresAt": val.get("expiresAt"),
            "isMaster": val.get("isMaster")
        }
    }

@app.get('/api/admin/keys')
def list_admin_keys():
    vip = check_vip(request)
    if not vip["isMaster"]:
        response.status = 403
        return {"success": False, "message": "需要最高級總控管理員權限 (0815065)"}
    return {"success": True, "keys": key_mgr.list_keys()}

@app.post('/api/admin/keys/generate')
def generate_key_route():
    vip = check_vip(request)
    if not vip["isMaster"]:
        response.status = 403
        return {"success": False, "message": "需要最高級總控管理員權限 (0815065)"}
    data = request.json or {}
    days = data.get('days')
    # 若傳入 None 或 0 或字串 '0' 代表永久
    if days is not None:
        try:
            days = int(days)
            if days <= 0:
                days = None
        except:
            days = 30
    desc = data.get('description')
    new_k = key_mgr.generate_key(days=days, description=desc)
    return {"success": True, "message": "新金鑰派發成功", "key": new_k}

@app.post('/api/admin/keys/toggle')
def toggle_key_route():
    vip = check_vip(request)
    if not vip["isMaster"]:
        response.status = 403
        return {"success": False, "message": "需要最高級總控管理員權限"}
    data = request.json or {}
    k = data.get('key')
    en = data.get('enabled')
    res = key_mgr.toggle_key(k, en)
    if not res:
        response.status = 404
        return {"success": False, "message": "找不到該金鑰"}
    return {"success": True, "message": f"金鑰狀態已更新為: {'啟用' if res.get('enabled') else '停用'}", "key": res}

@app.post('/api/admin/keys/delete')
def delete_key_route():
    vip = check_vip(request)
    if not vip["isMaster"]:
        response.status = 403
        return {"success": False, "message": "需要最高級總控管理員權限"}
    data = request.json or {}
    k = data.get('key')
    res = key_mgr.delete_key(k)
    return {"success": True, "message": "金鑰已刪除" if res else "無法刪除總控金鑰或金鑰不存在"}

@app.get('/api/admin/cookies/status')
def cookies_status():
    vip = check_vip(request)
    if not vip["isMaster"]:
        response.status = 403
        return {"success": False, "message": "需要最高級總控管理員權限"}
    has_cookies = os.path.exists(COOKIES_FILE) and os.path.getsize(COOKIES_FILE) > 20
    return {
        "success": True,
        "configured": has_cookies,
        "size": os.path.getsize(COOKIES_FILE) if os.path.exists(COOKIES_FILE) else 0,
        "message": "已載入 YouTube 專屬 Cookies 驗證" if has_cookies else "尚未配置 YouTube Cookies"
    }

@app.post('/api/admin/cookies')
def save_cookies():
    vip = check_vip(request)
    if not vip["isMaster"]:
        response.status = 403
        return {"success": False, "message": "需要最高級總控管理員權限"}
    data = request.json or {}
    cookies_content = data.get('cookies', '').strip()
    if not cookies_content:
        response.status = 400
        return {"success": False, "message": "Cookies 內容不能為空"}
    try:
        with open(COOKIES_FILE, 'w', encoding='utf-8') as f:
            f.write(cookies_content)
        return {"success": True, "message": "YouTube Cookies 已成功保存並即刻生效！"}
    except Exception as e:
        response.status = 500
        return {"success": False, "message": f"儲存失敗：{str(e)}"}

# 6. 前端靜態資源服務
@app.route('/assets/<filepath:path>')
def serve_assets(filepath):
    return static_file(filepath, root=os.path.join(DIST_DIR, 'assets'))

@app.route('/<filepath:path>')
def serve_static(filepath):
    target = os.path.join(DIST_DIR, filepath)
    if os.path.exists(target) and not os.path.isdir(target):
        return static_file(filepath, root=DIST_DIR)
    return static_file('index.html', root=DIST_DIR)

@app.route('/')
def index():
    return static_file('index.html', root=DIST_DIR)

# 7. 尋找可用埠號啟動服務
def find_available_port(start_port=3005):
    for p in range(start_port, start_port + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', p))
                return p
            except OSError:
                continue
    return start_port

def log_msg(msg):
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except:
        pass

def run_server(port):
    try:
        server = make_server('127.0.0.1', port, app, server_class=ThreadingWSGIServer)
        log_msg(f"[Server] 核心服務已就緒: http://127.0.0.1:{port}")
        server.serve_forever()
    except Exception as e:
        log_msg(f"[Server Error] {e}")

# 8. 主程式進入點 (GUI Window)
if __name__ == '__main__':
    try:
        log_msg(f"=== RPJG Desktop 啟動中 (frozen={getattr(sys, 'frozen', False)}) ===")
        port = find_available_port(3005)
        log_msg(f"選定伺服器埠號: {port}")
        
        # 啟動背景 WSGI 伺服器
        srv_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
        srv_thread.start()

        # 確保伺服器就緒
        time.sleep(0.6)

        # 建立原生桌面視窗
        log_msg("建立原生桌面視窗...")
        window = webview.create_window(
            title='RPJG 影音流體極速下載終端 - 桌面旗艦版',
            url=f'http://127.0.0.1:{port}',
            width=1240,
            height=820,
            min_size=(960, 640),
            background_color='#070b14'
        )

        log_msg("啟動 webview 事件循環...")
        webview.start()
        log_msg("應用程式主視窗已關閉，正常退出。")
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        log_msg(f"[FATAL EXCEPTION]\n{err_msg}")
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, f"啟動發生異常：\n{e}\n\n詳細記錄請參閱：%APPDATA%\\RPJG-MediaDownloader\\app.log", "RPJG 桌面版錯誤", 0x10)
        except:
            pass
