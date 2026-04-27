# Terraform — AWS Infrastructure

This directory defines the AWS infrastructure for the automation platform using Terraform.

---

## What's Defined

| Resource | Purpose |
|---|---|
| VPC + subnets | Isolated network with public and private subnets across 2 AZs |
| ECS Fargate cluster | Runs the Flask API as a container (serverless compute) |
| ECR repository | Stores Docker images; auto-expires old images |
| Application Load Balancer | Routes traffic to ECS tasks; runs health checks |
| CloudWatch Log Group | Centralised logging with 30-day retention |
| IAM roles | Least-privilege task execution role |
| Security groups | ALB open to internet; ECS tasks only accept traffic from ALB |

---

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5.0
- [AWS CLI](https://aws.amazon.com/cli/) configured with valid credentials
- An AWS account

---

## Setup

### 1. Configure AWS credentials

```bash
aws configure
# Enter: Access Key ID, Secret Access Key, Region (ap-southeast-2), output format (json)
```

### 2. Initialise Terraform

```bash
cd terraform
terraform init
```

### 3. Preview what will be created

```bash
terraform plan -var="environment=dev"
```

This shows every resource that will be created/changed/destroyed — **always review before applying**.

### 4. Apply (create resources)

```bash
terraform apply -var="environment=dev"
# Type 'yes' when prompted
```

### 5. Destroy (clean up resources)

```bash
terraform destroy -var="environment=dev"
# Type 'yes' when prompted
```

> **Cost note:** ECS Fargate and ALB incur AWS charges. Always destroy dev environments when not in use.

---

## Variables

| Variable | Default | Description |
|---|---|---|
| `aws_region` | `ap-southeast-2` | AWS region (Sydney for APAC) |
| `environment` | `dev` | `dev`, `staging`, or `production` |
| `app_name` | `automation-platform` | Used in resource naming |
| `vpc_cidr` | `10.0.0.0/16` | VPC CIDR block |
| `task_cpu` | `256` | ECS task CPU (256 = 0.25 vCPU) |
| `task_memory` | `512` | ECS task memory (MB) |
| `desired_count` | `1` | Number of running ECS tasks |

Override variables at apply time:

```bash
terraform apply \
  -var="environment=staging" \
  -var="desired_count=2" \
  -var="task_cpu=512"
```

---

## Deploying the Application

After infrastructure is created:

### 1. Build and push Docker image

```bash
# Get ECR login token
aws ecr get-login-password --region ap-southeast-2 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.ap-southeast-2.amazonaws.com

# Build image
docker build -t automation-platform .

# Tag for ECR
docker tag automation-platform:latest \
  <account-id>.dkr.ecr.ap-southeast-2.amazonaws.com/automation-platform-dev:latest

# Push
docker push <account-id>.dkr.ecr.ap-southeast-2.amazonaws.com/automation-platform-dev:latest
```

### 2. Force ECS to deploy the new image

```bash
aws ecs update-service \
  --cluster automation-platform-dev \
  --service automation-platform-dev \
  --force-new-deployment
```

### 3. Run E2E tests against the deployed environment

```bash
API_BASE_URL=http://<alb-dns-name> pytest tests/e2e/ -v
```

---

## Remote State (recommended for teams)

Uncomment and configure the `backend "s3"` block in `main.tf`:

```hcl
backend "s3" {
  bucket = "your-terraform-state-bucket"
  key    = "automation-platform/terraform.tfstate"
  region = "ap-southeast-2"
}
```

Create the S3 bucket first:

```bash
aws s3 mb s3://your-terraform-state-bucket --region ap-southeast-2
aws s3api put-bucket-versioning \
  --bucket your-terraform-state-bucket \
  --versioning-configuration Status=Enabled
```
