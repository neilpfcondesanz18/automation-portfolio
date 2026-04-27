# variables.tf — Input variables for the automation platform infrastructure
# ==========================================================================
# All configurable values live here.
# This lets the same Terraform code deploy to dev, staging, and production
# just by changing variable values — no code duplication.

variable "aws_region" {
  description = "AWS region to deploy into. APAC regions: ap-southeast-2 (Sydney), ap-southeast-1 (Singapore)"
  type        = string
  default     = "ap-southeast-2"
}

variable "environment" {
  description = "Deployment environment: dev, staging, or production"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be one of: dev, staging, production"
  }
}

variable "app_name" {
  description = "Application name used for naming AWS resources"
  type        = string
  default     = "automation-platform"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "task_cpu" {
  description = "ECS task CPU units (256 = 0.25 vCPU, 512 = 0.5 vCPU)"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "ECS task memory in MB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of ECS task replicas to run"
  type        = number
  default     = 1
}
