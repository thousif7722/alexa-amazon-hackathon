# ActionOS · AWS EC2 Deployment Guide

Complete step-by-step production deployment guide for hosting the **ActionOS Alexa+ OneWayFix Assistant** on **Amazon EC2** using Docker, Nginx, and Certbot SSL.

---

## 1. Prerequisites & EC2 Provisioning

### A. Recommended Instance Specifications
- **Instance Type**: `t3.small` (2 vCPU, 2GB RAM) or `t3.medium`
- **Operating System**: Ubuntu 22.04 LTS 64-bit (x86_64)
- **Storage**: 20 GB gp3 SSD

### B. Security Group Rules
Configure your EC2 Security Group inbound rules:

| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | 22 | Your IP / Any | Remote administration |
| **HTTP** | TCP | 80 | 0.0.0.0/0 | Public web traffic |
| **HTTPS** | TCP | 443 | 0.0.0.0/0 | Secure web traffic |
| **Custom TCP** | TCP | 3001 | 0.0.0.0/0 | Optional direct MCP access |

### C. AWS IAM Role for Bedrock Access (Recommended)
Attach an IAM Role to your EC2 instance with the following inline policy so you do **not** need hardcoded `AWS_ACCESS_KEY_ID` in `.env`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockNovaConverseAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 2. Server Environment Setup

Connect to your EC2 instance via SSH:

```bash
ssh -i your-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

### Install Docker & Docker Compose

```bash
# Update package list and install prerequisites
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg lsb-release nginx git

# Add Docker’s official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker ubuntu
newgrp docker
```

---

## 3. Application Deployment

### A. Clone Repository & Setup Environment

```bash
cd ~
git clone https://github.com/your-repo/actionos-onewayfix.git app
cd app

# Copy environment template
cp .env.example .env
nano .env
```

Set your production environment variables in `.env`:

```ini
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0

MCP_PORT=3001
MCP_SERVER_URL=http://localhost:3001/mcp

ONEWAYFIX_MOCK=true
MOCK_DATA_DIR=./data
```

*(Note: If using EC2 IAM Role, leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` empty)*.

### B. Launch Application Stack with Persistent Data

```bash
# Ensure data directory exists for volume mount
mkdir -p data

# Build and start container background daemon
docker compose up -d --build
```

Verify container health:

```bash
docker compose ps
docker logs -f actionos-alexaplus
```

---

## 4. Nginx Reverse Proxy & SSL Setup

### A. Create Nginx Site Configuration

```bash
sudo nano /etc/nginx/sites-available/actionos
```

Paste the following configuration (replace `your-domain.com` with your domain or server IP):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /mcp {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the configuration:

```bash
sudo ln -s /etc/nginx/sites-available/actionos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### B. Install Free HTTPS SSL Certificate (Certbot)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 5. Verification & Testing Checklist

1. **Web UI**: Open `https://your-domain.com` in browser. Verify dark glassmorphic interface loads with Quick-start chips.
2. **Technician Troubleshooting**: Ask `"Why is my AC not cooling?"`. Ensure step-by-step causes and safe self-checks are returned.
3. **Medium-Risk Confirmation**: Request a booking (`"Book AC Repair for tomorrow at 10 AM"`). Confirm the amber Confirmation Card renders and no booking is placed until clicking **Confirm & Book**.
4. **Persistence**: Restart container (`docker compose restart`). Verify previously created bookings persist from `./data/bookings.json`.

---

## Troubleshooting & Maintenance

- **View Logs**: `docker compose logs -f`
- **Rebuild Code**: `git pull && docker compose up -d --build`
- **Restart Backend**: `docker compose restart`
