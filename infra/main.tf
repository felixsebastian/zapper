terraform {
  required_version = ">= 1.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "gcs" {
    prefix = "terraform/state/zapper"
  }
}

provider "vercel" {
  api_token = var.vercel_api_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
