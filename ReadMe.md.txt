# Antigravity 메모장 — 설계·구현·DB·AI 프롬프트 (Markdown)

아래는 **2~3줄 메모용 간단 웹앱**을 `Antigravity`로(플랫폼/호스팅으로 가정) 만들기 위한 설계와 구현 가이드야. 디자인 개선 포인트, 백엔드·DB 설계, 프론트엔드 코드(동작 가능한 예제), 배포/운영 팁, 그리고 AI에게 요청할 프롬프트까지 모두 포함했어. 바로 복사해서 사용하거나 수정해서 써도 돼.

---

# 개요

* 목적: 2~3줄 텍스트를 빠르게 저장/불러오기/삭제할 수 있는 간단한 메모 웹앱.
* 화면: 상단에 2~3줄 텍스트 입력(자동 줄바꿈), 하단에 버튼 3개(저장, 불러오기, 삭제). 간단한 메모 목록 표시(선택해서 불러오기 가능).
* 기술 스택 제안(간단하고 배포 쉬움)

  * 프론트엔드: HTML + Vanilla JavaScript (또는 간단한 React)
  * 백엔드: Node.js + Express
  * DB: SQLite (로컬/경량), 필요하면 PostgreSQL로 전환 가능
  * 배포: Antigravity 플랫폼(또는 유사 서비스)에 Node 앱 배포

---

# 1) 화면(디자인) — 최소/깔끔

* 입력창: `<textarea rows="3" maxlength="300">` — 3줄 고정 느낌, 최대 글자수 제한.
* 버튼: 저장(POST), 불러오기(GET 목록), 삭제(DELETE 선택한 메모).
* 메모 목록: 최근 저장된 메모 10개를 보여주는 드롭다운 또는 리스트(클릭 시 입력창으로 로드).
* UX 개선 포인트

  * 저장 시 토스트(성공/실패) 표시
  * 로컬 저장소(fallback) — 네트워크 실패 시 브라우저 localStorage에 임시 저장
  * 모바일에서 큰 버튼, 충분한 터치 영역
  * 접근성: 버튼에 aria-label 추가

---

# 2) DB 설계 (SQLite 예시)

간단한 테이블 하나로 충분함.

```sql
-- schema.sql
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

설명: `content`에 메모 텍스트(최대 길이는 앱 레벨에서 제한), `created_at`으로 정렬 가능.

---

# 3) 백엔드 (Node.js + Express + sqlite3)

아래 코드는 최소 실행 가능한 서버 예제야. `npm init -y` 후 `npm i express sqlite3 cors` 설치.

```js
// index.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // 프론트 파일 제공

const DB_PATH = path.join(__dirname, 'notes.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// 저장
app.post('/api/notes', (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });
  const stmt = db.prepare('INSERT INTO notes (content) VALUES (?)');
  stmt.run(content.trim(), function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, content, created_at: new Date().toISOString() });
  });
  stmt.finalize();
});

// 목록 (최신순 20)
app.get('/api/notes', (req, res) => {
  db.all('SELECT id, content, created_at FROM notes ORDER BY created_at DESC LIMIT 20', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 특정 메모 삭제
app.delete('/api/notes/:id', (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM notes WHERE id = ?', id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'not found' });
    res.json({ deletedId: id });
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

**설치 / 실행**

```bash
npm init -y
npm i express sqlite3 cors
node index.js
# 또는 개발 중엔 nodemon 권장
```

---

# 4) 프론트엔드 (public/index.html) — 심플하고 예쁜 UI

아래는 `public/index.html` 하나로 동작하는 예제야. (백엔드 정적 파일 제공 설정과 호환)

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>빠른 메모장</title>
<style>
  :root{--bg:#f6f8fb;--card:#fff;--accent:#4f46e5;--muted:#65748b}
  body{font-family:Inter,system-ui,Segoe UI,Roboto,"Noto Sans KR",sans-serif;background:var(--bg);display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .card{width:360px;padding:20px;border-radius:12px;background:var(--card);box-shadow:0 6px 18px rgba(16,24,40,0.08)}
  h1{margin:0 0 10px;font-size:18px}
  textarea{width:100%;resize:none;border:1px solid #e6e9ef;padding:10px;border-radius:8px;font-size:14px;line-height:1.4}
  .row{display:flex;gap:8px;margin-top:10px}
  button{flex:1;padding:10px;border-radius:8px;border:0;background:var(--accent);color:white;font-weight:600;cursor:pointer}
  button.secondary{background:#eef2ff;color:var(--accent);border:1px solid rgba(79,70,229,0.08)}
  select{width:100%;margin-top:10px;padding:8px;border-radius:8px;border:1px solid #e6e9ef}
  .toast{position:fixed;right:20px;bottom:20px;background:#111;color:#fff;padding:10px 14px;border-radius:8px;opacity:0.95}
  .muted{color:var(--muted);font-size:13px;margin-top:8px}
</style>
</head>
<body>
  <div class="card" role="main">
    <h1>간단 메모장</h1>
    <textarea id="memo" rows="3" maxlength="300" placeholder="메모를 입력하세요 (최대 300자)"></textarea>
    <div class="row">
      <button id="saveBtn">저장</button>
      <button id="loadBtn" class="secondary">불러오기</button>
      <button id="deleteBtn" class="secondary">삭제</button>
    </div>
    <select id="notesList" size="4" style="margin-top:10px"></select>
    <div class="muted">저장된 메모를 선택한 뒤 불러오기 또는 삭제를 누르세요.</div>
  </div>

  <script>
    const memo = document.getElementById('memo');
    const saveBtn = document.getElementById('saveBtn');
    const loadBtn = document.getElementById('loadBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const notesList = document.getElementById('notesList');

    async function fetchNotes() {
      try {
        const res = await fetch('/api/notes');
        if (!res.ok) throw new Error('네트워크 오류');
        const data = await res.json();
        notesList.innerHTML = '';
        data.forEach(n => {
          const opt = document.createElement('option');
          opt.value = n.id;
          opt.textContent = n.content.length>60 ? n.content.slice(0,57)+'...' : n.content;
          opt.title = n.content;
          notesList.appendChild(opt);
        });
      } catch (e) {
        showToast('메모 불러오기 실패 — 오프라인이면 로컬 저장소에서 불러옵니다.');
        loadFromLocal();
      }
    }

    async function saveNote() {
      const content = memo.value.trim();
      if (!content) { showToast('내용을 입력하세요'); return; }
      try {
        const res = await fetch('/api/notes', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ content })
        });
        if (!res.ok) throw new Error('저장 실패');
        memo.value = '';
        await fetchNotes();
        showToast('저장 완료');
        localStorage.removeItem('draft'); // 성공하면 임시 삭제
      } catch (e) {
        // 실패 시 로컬에 임시 저장
        saveToLocal(content);
        showToast('서버 저장 실패 — 로컬에 임시 저장됨');
      }
    }

    async function deleteNote() {
      const id = notesList.value;
      if (!id) { showToast('삭제할 메모를 선택하세요'); return; }
      if (!confirm('정말 삭제할까요?')) return;
      try {
        const res = await fetch('/api/notes/' + id, { method:'DELETE' });
        if (!res.ok) throw new Error('삭제 실패');
        await fetchNotes();
        showToast('삭제 완료');
      } catch (e) {
        showToast('삭제 실패: 네트워크 확인');
      }
    }

    function loadSelected() {
      const opt = notesList.selectedOptions[0];
      if (!opt) { showToast('불러올 메모를 선택하세요'); return; }
      memo.value = opt.title;
      showToast('메모 불러오기 완료');
    }

    // 로컬 임시 저장(네트워크 실패 대비)
    function saveToLocal(content) {
      localStorage.setItem('draft', JSON.stringify({ content, t: Date.now() }));
    }
    function loadFromLocal() {
      const j = localStorage.getItem('draft');
      if (!j) return;
      const obj = JSON.parse(j);
      memo.value = obj.content || '';
      showToast('로컬 임시 메모 불러옴');
    }

    // 토스트
    function showToast(msg) {
      const div = document.createElement('div');
      div.className = 'toast';
      div.textContent = msg;
      document.body.appendChild(div);
      setTimeout(()=> div.remove(), 2500);
    }

    // 이벤트
    saveBtn.addEventListener('click', saveNote);
    loadBtn.addEventListener('click', fetchNotes);
    deleteBtn.addEventListener('click', deleteNote);
    notesList.addEventListener('dblclick', loadSelected);

    // 초기화
    fetchNotes();
    loadFromLocal();

    // 작성 중 자동 임시저장(5초 간격)
    let draftTimer;
    memo.addEventListener('input', () => {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(()=> saveToLocal(memo.value), 5000);
    });
  </script>
</body>
</html>
```

---

# 5) 배포 & 운영 팁 (Antigravity 가정)

* 환경변수로 `PORT` 설정. DB는 로컬 `notes.db`를 사용하면 간단하지만, 플랫폼에 따라 파일 시스템이 휘발성일 수 있어. 영구저장이 필요하면 관리형 DB(Postgres) 사용을 권장.
* HTTPS 강제, CORS 도메인 제한
* 로그: 저장/삭제에 대한 간단한 로깅 남기기
* 백업: DB 파일 정기 백업(또는 스냅샷)
* 확장: 사용자 인증 추가(개별 사용자별 메모), 메모 암호화(민감 데이터 방지)

---

# 6) 보안/프라이버시 고려사항 (짧게)

* XSS 방어: 메모 내용을 화면에 그대로 보여줄 때는 텍스트로만 노출(HTML로 주입하지 않음).
* 인증이 없으면 누구나 접근 가능 — 개인용이면 인증 필수.
* DB 접근 권한 최소화, 정기 백업 암호화.

---

# 7) AI에게 요청할 프롬프트 (복사/붙여넣기용 — MD 형식)

## 디자인 개선 요청 (UI/UX 디자이너용)

```
너는 웹 UI/UX 디자이너야. "간단 메모장" 웹앱(입력창 2~3줄, 버튼 3개(저장, 불러오기, 삭제), 메모 목록 표시)을 더 세련되고 사용성 좋게 디자인해줘. 
요구사항:
- 모바일과 데스크탑 모두에 적합한 반응형 레이아웃
- 명확한 시각 계층(버튼 색상, 입력 강조)
- 접근성(contrast, aria 텍스트)
- 애니메이션은 부드럽고 성능 저하 적게
- 컬러 팔레트 제안(2가지: 모던/미니멀, 따뜻한/친근)
- 각 화면의 와이어프레임(데스크탑/모바일)과 1~2개의 고해상도 시각 mockup 설명
출력 형식: (1) 간단한 요약 (2) 컬러 팔레트 및 폰트 추천 (3) 와이어프레임 텍스트 도식 (4) CSS 코드 스니펫 예시
```

## 코드 생성 요청 (풀스택 개발자용)

```
너는 경험 많은 풀스택 개발자야. 아래 요구사항에 맞춰 코드 샘플을 생성해줘.
요구사항:
- Node.js + Express 백엔드 (SQLite 사용), REST API: POST /api/notes, GET /api/notes, DELETE /api/notes/:id
- CORS 설정, JSON body 파싱, 에러 처리 포함
- 프론트엔드: HTML, CSS, Vanilla JS(또는 React)로 동작하는 단일 페이지. textarea(3줄), 버튼 3개, 저장된 메모 목록 표시 및 선택 후 불러오기/삭제 가능.
- 로컬스토리지에 임시저장(fallback) 구현
- SQL 스키마 파일과 package.json 샘플 포함
- 보안: 입력 검증, XSS 방어 기초 설명
출력 형식: (1) 파일/폴더 구조 (2) 주요 파일의 전체 코드 (3) 실행 및 배포 가이드 (커맨드)
```

---

# 마무리(요약)

* 제공한 내용: UI 설계, DB 스키마, 백엔드(Express+SQLite) 코드, 프론트엔드(HTML/JS) 예제, 배포·보안 팁, AI에게 줄 프롬프트(디자인·코드용).
* 다음 권장 작업: 바로 위 코드를 로컬에서 실행해보고, Antigravity(혹은 실제 배포 플랫폼) 환경에 맞춰 DB 영속성을 확인해. 사용자 인증이 필요하면 그 부분부터 확장해.

필요하면 내가 위 코드를 실제 리포지토리 구조로 만들어줄게(예: `package.json`, `README.md`, `schema.sql` 포함). 어떤 식으로 받을래? (예: GitHub-ready zip / 단일 파일 / 바로 배포 가능한 형태)
