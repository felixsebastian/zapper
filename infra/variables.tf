variable "project_name" {
  description = "Project name used for resource naming and default subdomain"
  type        = string
  default     = "zapper"
}

variable "domain" {
  description = "Base domain for the landing page subdomain"
  type        = string
  default     = "mp-lb.dev"
}

variable "landing_page_domain" {
  description = "Fully qualified landing page domain. Defaults to project_name.domain."
  type        = string
  default     = ""
}

variable "landing_page_dns_record_type" {
  description = "Cloudflare DNS record type for the landing page domain. Use CNAME for subdomains and A for apex domains."
  type        = string
  default     = "CNAME"
}

variable "landing_page_dns_record_content" {
  description = "Cloudflare DNS record content for the landing page domain. Use cname.vercel-dns.com for subdomains or Vercel's A record value for apex domains."
  type        = string
  default     = "cname.vercel-dns.com"
}

variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for the domain"
  type        = string
  default     = ""
}

variable "manage_cloudflare_dns" {
  description = "Whether Terraform should create the Cloudflare DNS record"
  type        = bool
  default     = true
}
