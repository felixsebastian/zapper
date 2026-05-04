locals {
  landing_page_domain                 = var.landing_page_domain != "" ? var.landing_page_domain : "${var.project_name}.${var.domain}"
  landing_page_cloudflare_record_name = trimsuffix(local.landing_page_domain, ".${var.domain}")
}

resource "vercel_project" "landing_page" {
  name           = var.project_name
  framework      = "nextjs"
  root_directory = "apps/landing-page"

  vercel_authentication = {
    deployment_type = "none"
  }
}

resource "vercel_project_domain" "landing_page" {
  project_id = vercel_project.landing_page.id
  domain     = local.landing_page_domain
}
