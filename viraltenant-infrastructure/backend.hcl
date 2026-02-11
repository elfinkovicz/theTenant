# Multi-Tenant Terraform Backend Configuration
bucket         = "creator-platform-terraform-state-multitenant"
key            = "terraform.tfstate"
region         = "eu-central-1"
encrypt        = true
dynamodb_table = "creator-platform-terraform-locks-multitenant"
profile        = "viraltenant"
