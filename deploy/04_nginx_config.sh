#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Step 4: Nginx Configuration
#  Creates server blocks for all web apps + API gateway
#  Includes: SSL, gzip, proxy, static file serving, caching
# ═══════════════════════════════════════════════════════════

set -e

DOMAIN="winlux.com"
NGINX_DIR="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

echo "════════════════════════════════════════════════"
echo "  WinLux — Nginx Configuration"
echo "════════════════════════════════════════════════"
echo ""

# ── Remove default site ──
rm -f ${NGINX_ENABLED}/default

# ── API Gateway ──
echo "[1/6] Creating API gateway config..."
cat > ${NGINX_DIR}/api.${DOMAIN} << 'NGINX'
# API Gateway — proxy to Express.js services
server {
    listen 443 ssl http2;
    server_name api.winlux.com;

    ssl_certificate /etc/letsencrypt/live/api.winlux.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.winlux.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types application/json text/plain;
    gzip_min_length 1000;

    # Service routing
    location /trendbriefai/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /smartbuy/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /caremate/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /fintax/ {
        proxy_pass http://127.0.0.1:3003/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /video/ {
        proxy_pass http://127.0.0.1:3005/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.winlux.com;
    return 301 https://$host$request_uri;
}
NGINX

# ── TrendBrief Web ──
echo "[2/6] Creating TrendBrief web config..."
cat > ${NGINX_DIR}/trendbriefai.${DOMAIN} << 'NGINX'
server {
    listen 443 ssl http2;
    server_name trendbriefai.winlux.com;

    ssl_certificate /etc/letsencrypt/live/trendbriefai.winlux.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trendbriefai.winlux.com/privkey.pem;

    root /opt/trend-brief-ai/trendbriefai-web/dist/browser;
    index index.html;

    # Static assets — long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Angular SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
    gzip_min_length 1000;
}

server {
    listen 80;
    server_name trendbriefai.winlux.com;
    return 301 https://$host$request_uri;
}
NGINX

# ── SmartBuy Web ──
echo "[3/6] Creating SmartBuy web config..."
cat > ${NGINX_DIR}/smartbuy.${DOMAIN} << 'NGINX'
server {
    listen 443 ssl http2;
    server_name smartbuy.winlux.com;

    ssl_certificate /etc/letsencrypt/live/smartbuy.winlux.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smartbuy.winlux.com/privkey.pem;

    root /opt/smartbuy-ai/smartbuy-web/dist/browser;
    index index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
    gzip_min_length 1000;
}

server {
    listen 80;
    server_name smartbuy.winlux.com;
    return 301 https://$host$request_uri;
}
NGINX

# ── CareMate Web ──
echo "[4/6] Creating CareMate web config..."
cat > ${NGINX_DIR}/caremate.${DOMAIN} << 'NGINX'
server {
    listen 443 ssl http2;
    server_name caremate.winlux.com;

    ssl_certificate /etc/letsencrypt/live/caremate.winlux.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/caremate.winlux.com/privkey.pem;

    root /opt/caremate-ai/caremate-ui/dist/browser;
    index index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
    gzip_min_length 1000;
}

server {
    listen 80;
    server_name caremate.winlux.com;
    return 301 https://$host$request_uri;
}
NGINX

# ── FIN Tax Web ──
echo "[5/6] Creating FIN Tax web config..."
cat > ${NGINX_DIR}/fintax.${DOMAIN} << 'NGINX'
server {
    listen 443 ssl http2;
    server_name fintax.winlux.com;

    ssl_certificate /etc/letsencrypt/live/fintax.winlux.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fintax.winlux.com/privkey.pem;

    root /opt/fin-tax-ai/fin-tax-ui/dist/browser;
    index index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
    gzip_min_length 1000;
}

server {
    listen 80;
    server_name fintax.winlux.com;
    return 301 https://$host$request_uri;
}
NGINX

# ── Childhood Web (SSR) ──
echo "[6/6] Creating Childhood web config..."
cat > ${NGINX_DIR}/childhood.${DOMAIN} << 'NGINX'
server {
    listen 443 ssl http2;
    server_name childhood.winlux.com;

    ssl_certificate /etc/letsencrypt/live/childhood.winlux.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/childhood.winlux.com/privkey.pem;

    root /opt/ai-video-engine/childhood-ui/dist/browser;
    index index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
    gzip_min_length 1000;
}

server {
    listen 80;
    server_name childhood.winlux.com;
    return 301 https://$host$request_uri;
}
NGINX

# ── Enable all sites ──
echo ""
echo "Enabling sites..."
for conf in ${NGINX_DIR}/*.${DOMAIN}; do
  FILENAME=$(basename "$conf")
  ln -sf "$conf" "${NGINX_ENABLED}/${FILENAME}"
  echo "  ✅ Enabled: ${FILENAME}"
done

# ── Copy performance config ──
if [ -f "/opt/shared-libs/performance/007_nginx_caching.conf" ]; then
  cp /opt/shared-libs/performance/007_nginx_caching.conf /etc/nginx/conf.d/performance.conf
  echo "  ✅ Performance config copied"
fi

# ── Test & reload ──
echo ""
echo "Testing Nginx configuration..."
nginx -t

echo "Reloading Nginx..."
systemctl reload nginx

echo ""
echo "════════════════════════════════════════════════"
echo "  Nginx configured!"
echo ""
echo "  Sites enabled:"
ls -1 ${NGINX_ENABLED}/ | grep -v default
echo ""
echo "  Next: bash 05_firewall.sh"
echo "════════════════════════════════════════════════"
