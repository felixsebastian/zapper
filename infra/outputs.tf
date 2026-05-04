output "landing_page_url" {
  description = "Published landing page URL"
  value       = "https://${local.landing_page_domain}"
}

output "vercel_project_id" {
  description = "Vercel project ID for CLI deployments"
  value       = vercel_project.landing_page.id
}

output "landing_page_dns_record" {
  description = "Landing page DNS record to configure when DNS is managed outside Terraform"
  value = {
    name    = local.landing_page_domain
    type    = var.landing_page_dns_record_type
    content = var.landing_page_dns_record_content
  }
}
