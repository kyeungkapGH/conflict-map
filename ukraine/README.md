# Ukraine Map

우크라이나 지역 공습/상황 정보를 지도 위에 등록·조회하는 웹 서비스입니다.
컴퓨터를 잘 몰라도 아래 순서대로 따라 하면 새 서버(VPS)에 설치할 수 있습니다.

이 문서에서 `$` 로 시작하는 줄은 **터미널(명령어 입력창)에 그대로 복사해서 붙여넣고 Enter**를 누르면 되는 명령어입니다. `$` 자체는 입력하지 않습니다.

---

## 1. 준비물 확인

이 프로그램을 돌리려면 서버에 두 가지가 설치되어 있어야 합니다.

- **Node.js** (프로그램을 실행하는 엔진, 18 버전 이상)
- **PostgreSQL** (데이터를 저장하는 데이터베이스)

Ubuntu 계열 서버라면 아래 명령어로 한 번에 설치할 수 있습니다.

```
$ sudo apt update
$ sudo apt install -y postgresql nodejs npm
```

설치가 잘 됐는지 아래 명령어로 확인합니다. 버전 번호가 나오면 정상입니다.

```
$ node -v
$ npm -v
```

> Node.js 버전이 너무 낮게 나오면(예: 12.x), [nodejs.org](https://nodejs.org)의 설치 가이드를 참고해 18 버전 이상으로 설치해주세요.

---

## 2. 코드 옮기기

이 프로젝트 폴더(`UKRAINE-MAP`)를 원하는 서버로 그대로 복사하세요. 별도 GitHub 저장소로 관리하고 싶다면, 이 폴더에서 `git init` 후 원하는 원격 저장소에 push하면 됩니다.

---

## 3. 프로그램 설치

```
$ npm install
```

이 명령어는 프로그램이 필요로 하는 부품들(라이브러리)을 자동으로 내려받는 과정입니다. 몇 초~몇 분 걸릴 수 있습니다.

---

## 4. 데이터베이스(DB) 준비

> ⚠️ 같은 서버에 `lebanon-map` 등 다른 프로젝트가 이미 떠 있다면, 테이블 이름(`locations`, `map_lines`, `map_markers`)이 겹치지 않도록 **반드시 별도의 DB**를 사용하세요 (아래 4-2 참고).

### 4-1. PostgreSQL 접속용 비밀번호 설정

PostgreSQL이 처음 설치되면 `postgres`라는 사용자 계정이 자동으로 만들어집니다. 이 계정의 비밀번호를 설정합니다. (원하는 비밀번호로 `내비밀번호` 부분을 바꿔주세요. 이미 다른 프로젝트에서 설정해뒀다면 이 단계는 생략 가능합니다.)

```
$ sudo -u postgres psql -c "ALTER USER postgres PASSWORD '내비밀번호';"
```

### 4-2. 전용 데이터베이스 만들기

```
$ sudo -u postgres psql -c "CREATE DATABASE ukraine_map;"
```

### 4-3. 데이터 저장 공간(테이블) 만들기

이 프로젝트에는 필요한 테이블 구조가 `sql/schema.sql` 파일에 미리 정의되어 있습니다. 아래 명령어로 한 번에 만듭니다.

```
$ PGPASSWORD=내비밀번호 psql -U postgres -h localhost -d ukraine_map -f sql/schema.sql
```

`CREATE TABLE`이라는 메시지가 여러 줄 나오면 성공입니다.

### 4-4. (선택) 강/전선/점령지 마커 초기 데이터 넣기

`scripts/seed-map-features.js` 파일 안의 `LINES` / `CIRCLE_LOCS` / `X_LOCS` 배열은 기본적으로 비어 있습니다. 실제 좌표를 알고 있다면 이 파일을 채운 뒤 아래 명령어로 한 번에 넣을 수 있습니다. (모르면 건너뛰고, 나중에 관리자 페이지 `/admin.html`에서 하나씩 추가해도 됩니다.)

```
$ node scripts/seed-map-features.js
```

---

## 5. 환경 설정 파일(.env) 만들기

`.env` 파일은 비밀번호처럼 민감한 설정값을 코드와 분리해서 보관하는 파일입니다. 예시 파일을 복사해서 만듭니다.

```
$ cp .env.example .env
```

만들어진 `.env` 파일을 열어서 값을 채워줍니다. (터미널에서 편집하려면 `nano .env` 입력)

```
$ nano .env
```

| 항목 | 설명 |
|---|---|
| `PORT` | 이 프로그램이 사용할 포트 번호. 다른 프로젝트와 겹치지 않는 값(예: `3002`)을 사용하세요. |
| `DB_USER` | PostgreSQL 접속 계정. 보통 `postgres` |
| `DB_HOST` | DB 서버 주소. 같은 서버 안에 있다면 `localhost` |
| `DB_NAME` | 4-2에서 만든 DB 이름. `ukraine_map` |
| `DB_PASSWORD` | 4-1에서 설정한 비밀번호 |
| `DB_PORT` | PostgreSQL 포트. 보통 `5432` |
| `CORS_ORIGIN` | 외부 접속 허용 범위. 잘 모르면 `*` 그대로 두면 됩니다. |
| `DELETE_PASSWORD` | 관리 페이지에서 "지형지물 라인/점령지 마커"를 삭제할 때 요구되는 비밀번호. 원하는 값으로 설정하세요. |

`nano` 편집기에서는 값을 다 고친 뒤 `Ctrl + O` → `Enter` (저장) → `Ctrl + X` (닫기) 순서로 빠져나옵니다.

> ⚠️ `.env` 파일은 비밀번호가 들어있으니 절대 GitHub 등에 올리지 마세요. 이 프로젝트는 `.gitignore`에 이미 등록되어 있어 실수로 올라가지 않습니다.

---

## 6. 서버 실행

### 6-1. 일단 잘 되는지 테스트

```
$ node server.js
```

터미널에 `Ukraine map server running on port 3002` (설정한 포트 번호) 이라고 뜨면 성공입니다. `Ctrl + C`를 누르면 서버가 종료됩니다.

같은 서버 안에서 아래처럼 확인해볼 수 있습니다. (포트 번호는 `.env`에서 설정한 값으로 바꿔주세요)

```
$ curl http://localhost:3002/api/locations
```

데이터(JSON 형식 텍스트, 처음엔 빈 배열 `[]`)가 출력되면 정상입니다.

### 6-2. 서버가 꺼지지 않고 계속 돌게 하기 (pm2)

터미널을 닫아도 서버가 계속 실행되도록, 그리고 서버가 죽으면 자동으로 재시작되도록 `pm2`라는 도구를 사용하는 것을 추천합니다.

```
$ sudo npm install -g pm2
$ pm2 start server.js --name ukraine-map
```

서버 재부팅 후에도 자동으로 다시 실행되게 하려면:

```
$ pm2 save
$ pm2 startup
```

`pm2 startup` 실행 후 화면에 나오는 안내 명령어를 한 번 더 복사해서 실행해야 합니다 (계정 권한 관련 설정).

pm2로 실행 중인 상태 확인 / 로그 확인 / 재시작 명령어:

```
$ pm2 status
$ pm2 logs ukraine-map
$ pm2 restart ukraine-map
```

---

## 7. 브라우저에서 접속하기

서버의 공인 IP 주소로 접속합니다. (예: 서버 IP가 `1.2.3.4`, 포트가 `3002`라면)

- 지도 (상황 등록): `http://1.2.3.4:3002/`
- 데이터 관리 페이지 (조회/수정/삭제): `http://1.2.3.4:3002/admin.html`

방화벽 때문에 접속이 안 될 수 있습니다. 사용하는 포트를 열어줘야 합니다. (`ufw` 사용 시)

```
$ sudo ufw allow 3002/tcp
```

---

## 8. (선택) 포트 번호 없이 접속하게 하기

매번 `:3002`를 붙이지 않고 `http://1.2.3.4/` 처럼 접속하고 싶다면, `nginx`로 80번 포트를 연결해주면 됩니다. (이미 다른 프로젝트가 80번 포트를 쓰고 있다면 도메인/서브도메인 또는 경로 기준으로 분기해야 합니다.)

```
$ sudo apt install -y nginx
```

`/etc/nginx/sites-available/ukraine-map` 파일을 새로 만들고 아래 내용을 넣습니다.

```
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

적용하고 nginx를 재시작합니다.

```
$ sudo ln -s /etc/nginx/sites-available/ukraine-map /etc/nginx/sites-enabled/
$ sudo nginx -t
$ sudo systemctl reload nginx
$ sudo ufw allow 80/tcp
```

이제 `http://1.2.3.4/` 만으로 접속됩니다.

---

## 문제가 생겼을 때

- **`node server.js` 했는데 DB 관련 에러가 뜬다** → `.env`의 `DB_NAME`, `DB_PASSWORD` 등 값이 4번에서 설정한 값과 일치하는지 확인하세요.
- **브라우저에서 접속이 안 된다** → 방화벽(`ufw`)에서 포트가 열려 있는지, 서버가 실제로 실행 중인지(`pm2 status`) 확인하세요.
- **삭제 버튼을 눌렀는데 반응이 없다** → 브라우저 개발자도구(F12) → Network 탭에서 요청이 어떤 상태 코드로 실패하는지 확인해보세요. 회사/기관 네트워크에 따라 특정 요청을 막는 보안 장비가 있을 수 있습니다.
- **관리 페이지에서 라인/마커 삭제가 안 된다** → `.env`의 `DELETE_PASSWORD`와 입력한 비밀번호가 일치하는지 확인하세요.

---

## 프로젝트 구조 (참고용)

```
ukraine-map/
├── server.js              # 서버 시작 파일
├── src/
│   ├── db.js               # DB 연결 설정
│   ├── routes/              # API (상황 데이터 / 라인 / 마커)
│   └── middleware/           # 삭제 비밀번호 검증
├── public/                 # 브라우저에 보이는 화면 (지도, 관리 페이지)
├── sql/schema.sql          # DB 테이블 생성 스크립트
├── scripts/seed-map-features.js  # 강/전선/마커 초기 데이터 입력 (기본은 빈 템플릿)
└── .env                    # 비밀번호 등 환경 설정 (직접 만들어야 함, git에는 없음)
```
