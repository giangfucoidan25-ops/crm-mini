import http.server
import socketserver
import webbrowser
import os
import platform

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/api/get-data':
            db_path = os.path.join(DIRECTORY, 'database.json')
            if os.path.exists(db_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.end_headers()
                with open(db_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"error": "Database file not found"}')
        elif self.path.startswith('/api/fetch-drive-excel'):
            from urllib.parse import urlparse, parse_qs
            import urllib.request
            import pandas as pd
            import json
            import traceback
            import io
            
            try:
                query = parse_qs(urlparse(self.path).query)
                url = query.get('url', [''])[0]
                
                if not url:
                    raise Exception("Vui lòng cung cấp URL Google Drive")
                
                # Transform google sheets link to export link if needed
                if "docs.google.com/spreadsheets" in url and "/edit" in url:
                    url = url.split("/edit")[0] + "/export?format=xlsx"
                    
                print(f"Fetching Excel from: {url}")
                
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    excel_data = response.read()
                    
                df = pd.read_excel(io.BytesIO(excel_data))
                df = df.fillna('')
                
                records = df.to_dict('records')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response_data = {'data': records}
                self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
                traceback.print_exc()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/save-data':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            db_path = os.path.join(DIRECTORY, 'database.json')
            try:
                import json
                
                # Kiểm tra Concurrency (Xung đột ghi đè)
                base_timestamp = self.headers.get('X-Base-Timestamp', '')
                if base_timestamp and os.path.exists(db_path):
                    with open(db_path, 'r', encoding='utf-8') as f:
                        try:
                            current_db = json.load(f)
                            current_exported = current_db.get('exported_at', '')
                            # Nếu đĩa cứng có bản ghi mới hơn bản JS đang base vào
                            if current_exported and current_exported != base_timestamp:
                                self.send_response(409) # 409 Conflict
                                self.send_header('Content-Type', 'application/json')
                                self.end_headers()
                                self.wfile.write(b'{"error": "Conflict: Database modified externally"}')
                                return
                        except Exception:
                            pass
                            
                # Kiểm tra tính hợp lệ của dữ liệu JSON nhận được
                json_data = json.loads(post_data.decode('utf-8'))
                
                # Lưu đè vào file database.json
                with open(db_path, 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, ensure_ascii=False, indent=4)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(f'{{"error": "{str(e)}"}}'.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def open_in_chrome(url):
    try:
        # Thử tìm chrome trong đăng ký của hệ thống
        webbrowser.get('windows-default') # test
        chrome_paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Users\%USERNAME%\AppData\Local\Google\Chrome\Application\chrome.exe"
        ]
        opened = False
        for path in chrome_paths:
            expanded_path = os.path.expandvars(path)
            if os.path.exists(expanded_path):
                webbrowser.register('chrome', None, webbrowser.BackgroundBrowser(expanded_path))
                webbrowser.get('chrome').open(url)
                opened = True
                break
        
        if not opened:
            # Fallback
            webbrowser.open(url)
    except:
        webbrowser.open(url)

def start_server():
    global PORT
    max_attempts = 20
    for attempt in range(max_attempts):
        try:
            socketserver.TCPServer.allow_reuse_address = True
            with socketserver.TCPServer(("", PORT), Handler) as httpd:
                url = f"http://localhost:{PORT}"
                print("==============================================")
                print(f" CRM Mini dang chay tai: {url}")
                print("==============================================")
                print("Nhan Ctrl+C de tat server.")
                
                # Tu dong mo bang Chrome
                open_in_chrome(url)
                
                httpd.serve_forever()
                return
        except OSError:
            print(f"Cong {PORT} dang ban. Thu cong tiep theo...")
            PORT += 1
    print("LOI: Khong tim thay cong trong nao kha dung!")

if __name__ == '__main__':
    start_server()
