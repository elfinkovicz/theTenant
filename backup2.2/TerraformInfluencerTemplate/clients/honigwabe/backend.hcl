# Terraform Backend Configuration
bucket         = "honigwabe-terraform-state"
key            = "terraform.tfstate"
region         = "eu-central-1"
encrypt        = true
dynamodb_table = "honigwabe-terraform-locks"
profile        = "honigwabe"
